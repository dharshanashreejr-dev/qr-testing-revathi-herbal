// Phase 3 common layer: bookings (Parlour / Home Service), 5-minute slot lock, Pending Review, specialist availability.
// Every booking screen (customer, tracking, manager, and the admin board in Phase 4) reads and writes ONLY through here.
// BACKEND: bookings/blocked -> MySQL tables; slot locks -> Redis keys with a 300 s TTL (SET NX EX 300) so two people can never
//          hold the same specialist and time; submitBooking / approve / reject -> REST endpoints with RBAC (staff/admin only
//          for review); reminders -> scheduled job; SMS -> DLT gateway. Lock expiry and the Pending Review rule MUST be server-side.
import { KEYS, read, write, raw, uid } from './storage'
import { sendSms } from './sms'
import { currentUser } from './auth'
import { team, homeServiceAvailable, type Category } from './catalog'

export type Channel = 'SMS' | 'WhatsApp' | 'SMS + WhatsApp'
export type BookingMode = 'parlour' | 'home'
export type BookingStatus = 'Pending Review' | 'Confirmed' | 'Rejected' | 'Cancelled' | 'Completed'
export interface Reminder { label: string; at: string; channel: Channel; status: 'Sent' | 'Scheduled' | 'Cancelled' }
export interface HomeAddress { line1: string; city: string; state: string; pin: string }
export interface Booking {
  ref: string; serviceId: string; serviceName: string; category: string; duration: number; date: string; time: string
  specialists: string[]; guests: number; name: string; phone: string; email: string; notes: string
  channel: Channel; remind: boolean; reminders: Reminder[]; status: BookingStatus; total: number
  mode: BookingMode; address?: HomeAddress; userId?: string; createdAt: string
  /** Coupon used on this booking (e.g. FIRSTSERVICE10) and the rupees it took off. `total` is already after the discount. */
  coupon?: string; discount?: number
  reviewNote?: string; reviewedAt?: string
  /** Set by admin / staff: Scheduled | Checked-In | In Session | Completed | Rescheduled | No-Show. The customer's tracking page follows it live. */
  adminStatus?: string
}
export interface SlotLock {
  id: string; owner: string; serviceId: string; category: Category; date: string; time: string; duration: number
  guests: number; specialists: string[]; mode: BookingMode; expires: number
}

export const SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
export const CLOSE = 21 * 60
export const LOCK_TTL_MS = 5 * 60 * 1000
const EVT = 'rhbc-booking-change'

const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const overlap = (a: number, b: number, c: number, d: number) => a < d && c < b
const emit = () => { try { window.dispatchEvent(new Event(EVT)) } catch { /* no window (tests) */ } }

/** Pending Review rule (CRS 3.4). Home Service and Bridal Makeup are checked by the team first; plain parlour visits confirm at once. */
export const needsReview = (mode: BookingMode, category: string) => mode === 'home' || category === 'Bridal Makeup'
export { homeServiceAvailable }

// ---------- storage + one-time migration from the old `serene-*` keys ----------
function seed(): Booking[] { return [] } // no demo bookings: only real customer bookings
export function getBookings(): Booking[] {
  const v = read<Booking[] | null>(KEYS.bookings, null)
  if (v) return v
  const old = read<Partial<Booking>[] | null>('serene-bookings', null)
  const s = old ? old.map((b) => ({ mode: 'parlour' as BookingMode, createdAt: new Date().toISOString(), ...b }) as Booking) : seed()
  write(KEYS.bookings, s); return s
}
export const saveBookings = (b: Booking[]) => { write(KEYS.bookings, b); emit() }
export function getBlocked(): string[] {
  const v = read<string[] | null>(KEYS.blocked, null)
  if (v) return v
  const old = read<string[]>('serene-blocked', []); write(KEYS.blocked, old); return old
}
export function toggleBlock(date: string, name: string, time: string) {
  const k = `${date}|${name}|${time}`, b = getBlocked(); write(KEYS.blocked, b.includes(k) ? b.filter((x) => x !== k) : [...b, k]); emit()
}

// ---------- slot locks (5-minute hold while the customer fills in the form) ----------
/** Who is holding: the logged-in customer, or an anonymous id for this browser tab. */
export function ownerId(): string {
  const u = currentUser(); if (u) return u.id
  try { let a = sessionStorage.getItem(KEYS.anon); if (!a) { a = uid('anon'); sessionStorage.setItem(KEYS.anon, a) } return a } catch { return 'anon' }
}
const allLocks = () => read<SlotLock[]>(KEYS.locks, [])
/** Locks that are still running (expired ones are ignored everywhere, so nothing needs to clean them up first). */
export const activeLocks = (now = Date.now()) => allLocks().filter((l) => l.expires > now)
export const lockMsLeft = (l: SlotLock | null, now = Date.now()) => (l ? Math.max(0, l.expires - now) : 0)
export function getMyLock(): SlotLock | null { const me = ownerId(); return activeLocks().find((l) => l.owner === me) ?? null }

const ACTIVE: BookingStatus[] = ['Confirmed', 'Pending Review'] // Pending Review keeps the slot held until the team decides

/** A specialist is busy if blocked, booked (confirmed or pending), or locked by SOMEONE ELSE. Your own lock never blocks you. */
export function isBusy(name: string, date: string, time: string, dur: number, ignore?: string) {
  const a = toMin(time), b = a + dur, bl = getBlocked(), me = ownerId()
  if (SLOTS.some((s) => bl.includes(`${date}|${name}|${s}`) && overlap(a, b, toMin(s), toMin(s) + 60))) return true
  if (getBookings().some((x) => ACTIVE.includes(x.status) && x.ref !== ignore && x.date === date && x.specialists.includes(name) && overlap(a, b, toMin(x.time), toMin(x.time) + x.duration))) return true
  return activeLocks().some((l) => l.owner !== me && l.date === date && l.specialists.includes(name) && overlap(a, b, toMin(l.time), toMin(l.time) + l.duration))
}
export const freeSpecialists = (cat: Category, date: string, time: string, dur: number, ignore?: string, mode: BookingMode = 'parlour') =>
  team.filter((t) => t.categories.includes(cat) && (mode === 'parlour' || t.homeVisits) && !isBusy(t.name, date, time, dur, ignore))
export function slotOk(date: string, time: string, dur: number) {
  if (toMin(time) + dur > CLOSE) return false
  if (date === iso(new Date())) { const n = new Date(); return toMin(time) > n.getHours() * 60 + n.getMinutes() + 30 }
  return true
}
export const dayHasSlot = (date: string, cat: Category, dur: number, guests: number, mode: BookingMode = 'parlour') =>
  SLOTS.some((t) => slotOk(date, t, dur) && freeSpecialists(cat, date, t, dur, undefined, mode).length >= guests)

export type LockResult = { ok: true; lock: SlotLock } | { ok: false; reason: 'taken' | 'closed' }
/** Holds the chosen slot for 5 minutes. Picking another slot replaces your previous hold. */
export function acquireLock(i: { serviceId: string; category: Category; date: string; time: string; duration: number; guests: number; specialist: 'auto' | string; mode: BookingMode }): LockResult {
  if (!slotOk(i.date, i.time, i.duration)) return { ok: false, reason: 'closed' }
  const me = ownerId()
  write(KEYS.locks, activeLocks().filter((l) => l.owner !== me)) // drops expired locks and my old hold
  const free = freeSpecialists(i.category, i.date, i.time, i.duration, undefined, i.mode)
  const picked = i.specialist === 'auto' ? free.slice(0, i.guests) : free.filter((m) => m.name === i.specialist)
  if (picked.length < (i.specialist === 'auto' ? i.guests : 1)) { emit(); return { ok: false, reason: 'taken' } }
  const lock: SlotLock = { id: uid('lock'), owner: me, serviceId: i.serviceId, category: i.category, date: i.date, time: i.time, duration: i.duration, guests: i.guests, specialists: picked.map((m) => m.name), mode: i.mode, expires: Date.now() + LOCK_TTL_MS }
  write(KEYS.locks, [...activeLocks(), lock]); emit()
  return { ok: true, lock }
}
export function releaseLock(id?: string) {
  const me = ownerId(); write(KEYS.locks, activeLocks().filter((l) => (id ? l.id !== id : l.owner !== me))); emit()
}

// ---------- creating and reviewing bookings ----------
export type NewBooking = Omit<Booking, 'ref' | 'reminders' | 'status' | 'mode' | 'createdAt' | 'userId' | 'reviewNote' | 'reviewedAt'> & { mode?: BookingMode }

function buildReminders(date: string, time: string, channel: Channel, confirmLabel = 'Booking confirmation'): Reminder[] {
  const start = new Date(`${date}T${time}:00`).getTime(), now = Date.now()
  const out: Reminder[] = [{ label: confirmLabel, at: new Date(now).toISOString(), channel, status: 'Sent' }]
  ;([[24, '24 hours before'], [2, '2 hours before']] as [number, string][]).forEach(([h, l]) => {
    const at = start - h * 3600e3
    if (at > now) out.push({ label: `Reminder · ${l}`, at: new Date(at).toISOString(), channel, status: 'Scheduled' })
  })
  return out
}
const smsConfirm = (b: Booking) => { if (b.channel !== 'WhatsApp') sendSms('apptConfirmed', b.phone, [b.serviceName, b.date, b.time, b.specialists.join(', ')]) }

/** Old entry point (no lock, always Confirmed, parlour). Kept so the current booking page keeps working until 3b/3c switch it to submitBooking. */
export function createBooking(i: NewBooking): Booking {
  const b: Booking = { ...i, mode: i.mode ?? 'parlour', createdAt: new Date().toISOString(), userId: currentUser()?.id, ref: 'SRN-' + Math.random().toString(36).slice(2, 8).toUpperCase(), status: 'Confirmed', reminders: i.remind ? buildReminders(i.date, i.time, i.channel) : [] }
  saveBookings([...getBookings(), b]); return b
}

export type SubmitResult = { ok: true; booking: Booking } | { ok: false; reason: 'lock-expired' | 'taken' | 'address' }
/** New entry point: needs a live lock, applies the Pending Review rule, sends the confirmation SMS when confirmed straight away. */
export function submitBooking(i: NewBooking, lockId: string): SubmitResult {
  const mode = i.mode ?? 'parlour', lock = activeLocks().find((l) => l.id === lockId && l.owner === ownerId())
  if (!lock) return { ok: false, reason: 'lock-expired' }
  if (mode === 'home' && !(i.address && i.address.line1.trim().length >= 5 && /^\d{6}$/.test(i.address.pin))) return { ok: false, reason: 'address' }
  const review = needsReview(mode, i.category), status: BookingStatus = review ? 'Pending Review' : 'Confirmed'
  const b: Booking = { ...i, mode, specialists: lock.specialists, createdAt: new Date().toISOString(), userId: currentUser()?.id, ref: 'RHB-' + Math.random().toString(36).slice(2, 8).toUpperCase(), status,
    reminders: review ? (i.remind ? [{ label: 'Request received', at: new Date().toISOString(), channel: i.channel, status: 'Sent' }] : []) : (i.remind ? buildReminders(i.date, i.time, i.channel) : []) }
  saveBookings([...getBookings(), b]); releaseLock(lockId) // the booking itself now holds the slot
  if (!review) smsConfirm(b)
  return { ok: true, booking: b }
}
export const pendingReview = () => getBookings().filter((b) => b.status === 'Pending Review')
/** Admin / staff: approve a Pending Review booking -> Confirmed, reminders start, confirmation SMS goes to the outbox. */
export function approveBooking(ref: string, specialists?: string[], note = ''): Booking | null {
  const b = getBookings().find((x) => x.ref === ref && x.status === 'Pending Review'); if (!b) return null
  const n: Booking = { ...b, status: 'Confirmed', specialists: specialists ?? b.specialists, reviewNote: note, reviewedAt: new Date().toISOString(),
    reminders: b.remind ? buildReminders(b.date, b.time, b.channel, 'Booking confirmation') : [] }
  saveBookings(getBookings().map((x) => (x.ref === ref ? n : x))); smsConfirm(n); return n
}
/** Admin / staff: reject a Pending Review booking (reason is shown to the customer); the slot is freed. */
export function rejectBooking(ref: string, note: string): Booking | null {
  const b = getBookings().find((x) => x.ref === ref && x.status === 'Pending Review'); if (!b) return null
  const n: Booking = { ...b, status: 'Rejected', reviewNote: note, reviewedAt: new Date().toISOString(), reminders: [] }
  saveBookings(getBookings().map((x) => (x.ref === ref ? n : x))); return n
}
export function updateBooking(ref: string, patch: Partial<Booking>) { saveBookings(getBookings().map((b) => (b.ref === ref ? { ...b, ...patch } : b))) }
export function cancelBooking(ref: string) {
  const b = getBookings().find((x) => x.ref === ref); if (!b) return
  updateBooking(ref, { status: 'Cancelled', reminders: b.reminders.map((r) => (r.status === 'Scheduled' ? { ...r, status: 'Cancelled' as const } : r)) })
}
/** Simulated scheduler: marks due reminders Sent. The 24-hour reminder also goes to the SMS outbox (the DLT template says "tomorrow"). */
export function processDue() {
  const now = Date.now(); let n = 0
  saveBookings(getBookings().map((b) => ({ ...b, reminders: b.reminders.map((r) => {
    if (r.status !== 'Scheduled' || new Date(r.at).getTime() > now) return r
    n++; if (r.label.includes('24 hours') && r.channel !== 'WhatsApp') sendSms('apptReminder', b.phone, [b.time])
    return { ...r, status: 'Sent' as const }
  }) })))
  return n
}

export function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb); window.addEventListener('storage', cb)
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) }
}
/** Snapshot key for useSyncExternalStore: changes whenever bookings or locks change. */
export const snapshotKey = () => raw(KEYS.bookings) + '|' + raw(KEYS.locks)

const storeLocale = () => { try { const l = localStorage.getItem('velvet-lang'); return ({ en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN', ml: 'ml-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN', bn: 'bn-IN', sa: 'sa-IN' } as Record<string, string>)[l || 'en'] || 'en-IN' } catch { return 'en-IN' } }
export const fmtDT = (iso_: string) => new Date(iso_).toLocaleString(storeLocale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
