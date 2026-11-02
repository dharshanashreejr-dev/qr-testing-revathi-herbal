// Customer-area mock data (localStorage). Replace with real API calls (orders, appointments, profile).
import { products, byId } from './shop'
import { services } from './data'
import { getBookings } from './store'
import { api } from '../api'

// Customer-facing order pipeline (5 steps): Order placed > Order confirmed > Order packed > Order shipped > Order delivered (or Cancelled).
export const ORDER_STAGES = ['Order placed', 'Order confirmed', 'Order packed', 'Order shipped', 'Order delivered']
export const ORDER_LAST = ORDER_STAGES.length - 1
/** First stage at which the parcel has left the studio (courier + tracking no. assigned, SMS sent, cancel no longer allowed). */
export const ORDER_SHIPPED = 3
// Localized labels when a lang is provided (en/ta/hi/ml/te)
export const ORDER_STAGES_I18N: Record<string, string[]> = {
  en: ORDER_STAGES,
  ta: ['ஆர்டர் வைக்கப்பட்டது', 'ஆர்டர் உறுதிசெய்யப்பட்டது', 'ஆர்டர் பேக் செய்யப்பட்டது', 'ஆர்டர் அனுப்பப்பட்டது', 'ஆர்டர் டெலிவரி ஆனது'],
  hi: ['ऑर्डर प्लेस हुआ', 'ऑर्डर की पुष्टि हुई', 'ऑर्डर पैक हुआ', 'ऑर्डर भेजा गया', 'ऑर्डर डिलीवर हुआ'],
  ml: ['ഓർഡർ പ്ലേസ് ചെയ്തു', 'ഓർഡർ സ്ഥിരീകരിച്ചു', 'ഓർഡർ പായ്ക്ക് ചെയ്തു', 'ഓർഡർ ഷിപ്പ് ചെയ്തു', 'ഓർഡർ ഡെലിവർ ചെയ്തു'],
  te: ['ఆర్డర్ ప్లేస్ అయింది', 'ఆర్డర్ నిర్ధారించబడింది', 'ఆర్డర్ ప్యాక్ అయింది', 'ఆర్డర్ షిప్ అయింది', 'ఆర్డర్ డెలివర్ అయింది'],
}
export const APPT_STAGES_I18N: Record<string, string[]> = {
  en: ['Confirmed', 'Specialist assigned', 'Check-in', 'In session', 'Completed'],
  ta: ['உறுதிப்படுத்தப்பட்டது', 'நிபுணர் நியமிக்கப்பட்டார்', 'செக்-இன்', 'அமர்வில்', 'முடிந்தது'],
  hi: ['पुष्टि', 'विशेषज्ञ नियुक्त', 'चेक-इन', 'सत्र में', 'पूर्ण'],
  ml: ['സ്ഥിരീകരിച്ചു', 'സ്പെഷ്യലിസ്റ്റ് നിയോഗിച്ചു', 'ചെക്ക്-ഇൻ', 'സെഷനിൽ', 'പൂർത്തിയായി'],
  te: ['నిర్ధారించబడింది', 'స్పెషలిస్ట్ కేటాయించబడ్డారు', 'చెక్-ఇన్', 'సెషన్‌లో', 'పూర్తయింది'],
}
export const APPT_STAGES = ['Confirmed', 'Specialist assigned', 'Check-in', 'In session', 'Completed']
export interface OrderItem { pid: string; name: string; img: string; qty: number; price: number; size: string }
export interface Order { id: string; placed: string; items: OrderItem[]; total: number; stage: number; courier: string; awb: string; eta: string; address: string; payment: string; log: { stage: number; at: string; note: string }[]; v?: number; cancelled?: boolean; customer?: string; phone?: string; dispatchSms?: boolean; userId?: string }
export interface Appt { ref: string; service: string; category: string; img: string; date: string; time: string; duration: number; specialist: string; room: string; price: number; status: 'Upcoming' | 'Pending Review' | 'Rejected' | 'Completed' | 'Cancelled'; stage: number; notes: string; mode?: 'parlour' | 'home'; address?: string; reviewNote?: string }
export interface Profile { name: string; email: string; phone: string; address: string; skin: string; birthday: string; tier: string; points: number; nextTier: number; since: string; notify: { whatsapp: boolean; sms: boolean; email: boolean } }

const OK = 'VELVET TOUCH-orders', PK = 'VELVET TOUCH-profile'
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d } }
const EVT = 'velvet-data'
export const emitData = () => { try { window.dispatchEvent(new Event(EVT)) } catch { /* ignore */ } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); emitData() } catch { /* ignore */ } }
/** Live updates: fires when orders / appointments change in this tab (EVT) or in another tab, e.g. the admin panel ('storage'). */
export function subscribeData(cb: () => void) {
  window.addEventListener(EVT, cb); window.addEventListener('storage', cb)
  const off = api.booking.subscribe(cb), tm = window.setInterval(cb, 4000) // 4 s safety net
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb); off(); window.clearInterval(tm) }
}
const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString()
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const notes = ['Order placed and payment received', 'Order confirmed by our team', 'Items quality-checked and packed in gift packaging', 'Handed to courier, on its way from our Coimbatore studio', 'Delivered and signed for']

const ADDR = ''
// Older saved orders (v1 = 5 old stages, v2 = 4 steps) are folded into the 5-step pipeline once.
const foldV1 = (n: number) => (n >= 4 ? 3 : n === 3 ? 2 : n)
const toV3 = (n: number) => [0, 2, 3, 4][Math.min(Math.max(n, 0), 3)]
function migrate(list: Order[]): Order[] {
  if (list.every((o) => o.v === 3)) return list
  const out = list.map((o) => {
    if (o.v === 3) return o
    const f = o.v === 2 ? (n: number) => n : foldV1
    const seen = new Set<number>(), log = [...o.log].reverse().map((l) => ({ ...l, stage: toV3(f(l.stage)) })).filter((l) => !seen.has(l.stage) && !!seen.add(l.stage)).reverse()
    return { ...o, stage: toV3(f(o.stage)), log, v: 3 }
  })
  write(OK, out); return out
}
export const getOrders = (): Order[] => { const v = read<Order[] | null>(OK, null); return v ? migrate(v) : [] }
/** The logged-in customer's own orders (the admin panel uses getOrders = everyone's). */
export const getMyOrders = (): Order[] => { const u = api.auth.currentUser(); return u ? getOrders().filter((o) => o.userId === u.id) : [] }
export function addOrder(items: OrderItem[]): Order {
  const total = items.reduce((s, i) => s + i.price * i.qty, 0)
  const id = 'VT-ORD-' + (10500 + Math.floor(Math.random() * 400))
  const o: Order = { id, placed: new Date().toISOString(), items, total, stage: 0, courier: 'To be assigned', awb: 'Pending', eta: day(4), address: getProfile().address, payment: 'Razorpay · Paid', log: [{ stage: 0, at: new Date().toISOString(), note: notes[0] }], v: 3, customer: getProfile().name, phone: getProfile().phone, userId: api.auth.currentUser()?.id }
  write(OK, [o, ...getOrders()]); return o
}
const fmtEta = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
export interface StageResult { ok: boolean; reason?: string; order?: Order; smsSent?: boolean }
/** Moves an order forward (Placed > Confirmed > Packed > Shipped > Delivered). Marking it Shipped sends the "Product Dispatched" SMS once.
 *  BACKEND: PATCH /api/orders/:id/status (Admin + Staff). The server sends the SMS and writes the audit entry. */
export function setOrderStage(id: string, next: number, note?: string): StageResult {
  const all = getOrders(), o = all.find((x) => x.id === id)
  if (!o) return { ok: false, reason: 'missing' }
  if (o.cancelled) return { ok: false, reason: 'cancelled' }
  if (next <= o.stage) return { ok: false, reason: 'backwards' }
  if (next > ORDER_LAST) return { ok: false, reason: 'range' }
  const at = new Date().toISOString()
  const log = [...o.log]
  for (let st = o.stage + 1; st <= next; st++) log.push({ stage: st, at, note: st === next && note ? note : notes[st] })
  let upd: Order = { ...o, stage: next, log }
  if (next >= ORDER_SHIPPED && upd.courier === 'To be assigned') upd = { ...upd, courier: 'BlueDart Express' }
  if (next >= ORDER_SHIPPED && upd.awb === 'Pending') upd = { ...upd, awb: 'BD' + Math.floor(1e9 + Math.random() * 9e9) }
  let smsSent = false
  if (next >= ORDER_SHIPPED && !o.dispatchSms) {
    api.sms.sendSms('orderDispatched', o.phone || getProfile().phone || 'Customer', [o.id, fmtEta(o.eta)])
    upd = { ...upd, dispatchSms: true }; smsSent = true
  }
  write(OK, all.map((x) => (x.id === id ? upd : x)))
  return { ok: true, order: upd, smsSent }
}
/** Cancel is allowed until the order is shipped. */
export function cancelOrder(id: string): StageResult {
  const all = getOrders(), o = all.find((x) => x.id === id)
  if (!o) return { ok: false, reason: 'missing' }
  if (o.cancelled || o.stage >= ORDER_SHIPPED) return { ok: false, reason: o.cancelled ? 'cancelled' : 'dispatched' }
  const upd: Order = { ...o, cancelled: true, log: [...o.log, { stage: o.stage, at: new Date().toISOString(), note: 'Order cancelled' }] }
  write(OK, all.map((x) => (x.id === id ? upd : x)))
  return { ok: true, order: upd }
}
export function updateShipping(id: string, patch: { courier?: string; awb?: string; eta?: string }) {
  write(OK, getOrders().map((o) => (o.id === id ? { ...o, ...patch } : o)))
}

/** Client stage (0 Confirmed, 1 Specialist assigned, 2 Check-in, 3 In session, 4 Completed) from what the admin / staff set. */
const stageOf = (b: { status: string; adminStatus?: string; specialists: string[] }) => {
  const a = b.adminStatus ?? (b.status === 'Completed' ? 'Completed' : '')
  if (a === 'Completed') return 4
  if (a === 'In Session') return 3
  if (a === 'Checked-In') return 2
  return b.specialists.length ? 1 : 0
}
/** The logged-in customer's own appointments, built from the real bookings (staff updates show up live). */
export function getAppts(): Appt[] {
  const u = api.auth.currentUser(); if (!u) return []
  return getBookings().filter((b) => b.userId === u.id).map((b): Appt => {
    const stage = stageOf(b), done = stage === 4 || b.status === 'Completed'
    const status: Appt['status'] = b.status === 'Cancelled' || b.adminStatus === 'No-Show' ? 'Cancelled' : b.status === 'Rejected' ? 'Rejected' : b.status === 'Pending Review' ? 'Pending Review' : done ? 'Completed' : 'Upcoming'
    return { ref: b.ref, service: b.serviceName, category: b.category, img: services.find((x) => x.id === b.serviceId)?.img ?? 'close', date: b.date, time: b.time, duration: b.duration,
      specialist: b.specialists.join(', '), room: b.mode === 'home' ? 'At your home' : 'Assigned at check-in', price: b.total, status, stage: done ? 4 : stage, notes: b.notes,
      mode: b.mode, address: b.address ? `${b.address.line1}, ${b.address.city}, ${b.address.state} ${b.address.pin}` : undefined, reviewNote: b.reviewNote }
  }).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time))
}
export function cancelAppt(ref: string) { api.booking.cancelBooking(ref) }

const defProfile: Profile = { name: '', email: '', phone: '', address: '', skin: '', birthday: '', tier: 'Member', points: 0, nextTier: 1000, since: String(new Date().getFullYear()), notify: { whatsapp: true, sms: true, email: false } }
export const getProfile = (): Profile => {
  const u = api.auth.currentUser(), a = u?.addresses[0]
  // The logged-in customer's own details always win over the sample profile.
  const mine: Partial<Profile> = u ? { name: u.name || 'Valued customer', phone: '+91 ' + u.phone, email: u.email, address: a ? `${a.line1}, ${a.city}, ${a.state} ${a.pin}` : '', since: String(new Date(u.createdAt).getFullYear()) } : {}
  return { ...defProfile, ...read<Partial<Profile>>(PK, {}), ...mine }
}
export const saveProfile = (p: Profile) => { write(PK, p); api.auth.updateProfile({ name: p.name, email: p.email }) }
const locale = () => { try { const l = localStorage.getItem('velvet-lang'); return ({ en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN', ml: 'ml-IN', te: 'te-IN' } as Record<string,string>)[l || 'en'] || 'en-IN' } catch { return 'en-IN' } }
export const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtWhen = (iso: string) => new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
