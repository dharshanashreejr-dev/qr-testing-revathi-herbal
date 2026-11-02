// Phone-number + SMS-OTP login (CRS 3.1). Mock server: OTP lives in localStorage and is shown on screen in demo mode.
// BACKEND: requestOtp -> POST /api/auth/otp, verifyOtp -> POST /api/auth/verify (returns a JWT), profile -> /api/me.
//          OTP generation, 5-minute expiry and the attempt limit MUST be enforced on the server.
import { KEYS, read, write, raw, uid } from './storage'
import { sendSms } from './sms'

export interface Address { id: string; label: string; line1: string; city: string; state: string; pin: string }
export interface User { id: string; phone: string; name: string; email: string; lang: string; addresses: Address[]; createdAt: string }
interface Otp { phone: string; code: string; expires: number; tries: number }
export type VerifyError = 'expired' | 'wrong' | 'locked' | 'none'

export const OTP_TTL_MS = 5 * 60 * 1000
const MAX_TRIES = 5
const EVT = 'rhbc-session-change'
export const isPhone = (p: string) => /^[6-9]\d{9}$/.test(p)

const users = () => read<User[]>(KEYS.users, [])
/** Admin panel: every registered customer. BACKEND: GET /api/customers */
export const allUsers = (): User[] => users()
const emit = () => window.dispatchEvent(new Event(EVT))

export function isNewUser(phone: string) { return !users().some((u) => u.phone === phone) }

export function requestOtp(phone: string): { ok: boolean; demoOtp?: string; expiresAt?: number } {
  if (!isPhone(phone)) return { ok: false }
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const otp: Otp = { phone, code, expires: Date.now() + OTP_TTL_MS, tries: 0 }
  write(KEYS.otp, otp)
  sendSms('otp', phone, [code])
  return { ok: true, demoOtp: code, expiresAt: otp.expires } // demoOtp only exists in the mock; the real API never returns it
}

export function verifyOtp(phone: string, code: string, name = '', lang = 'en'): { ok: true; user: User } | { ok: false; error: VerifyError } {
  const otp = read<Otp | null>(KEYS.otp, null)
  if (!otp || otp.phone !== phone) return { ok: false, error: 'none' }
  if (Date.now() > otp.expires) return { ok: false, error: 'expired' }
  if (otp.tries >= MAX_TRIES) return { ok: false, error: 'locked' }
  if (otp.code !== code.trim()) { write(KEYS.otp, { ...otp, tries: otp.tries + 1 }); return { ok: false, error: otp.tries + 1 >= MAX_TRIES ? 'locked' : 'wrong' } }
  localStorage.removeItem(KEYS.otp)
  let user = users().find((u) => u.phone === phone)
  if (!user) {
    user = { id: uid('cus'), phone, name: name.trim(), email: '', lang, addresses: [], createdAt: new Date().toISOString() }
    write(KEYS.users, [...users(), user])
  } else if (name.trim() && !user.name) user = saveUser({ name: name.trim() }, user.id) ?? user
  write(KEYS.session, { userId: user.id, token: 'demo-' + uid('jwt'), at: Date.now() })
  emit()
  return { ok: true, user }
}

function saveUser(patch: Partial<Omit<User, 'id' | 'phone'>>, id: string): User | null {
  const all = users(); const i = all.findIndex((u) => u.id === id)
  if (i < 0) return null
  all[i] = { ...all[i], ...patch }; write(KEYS.users, all); emit(); return all[i]
}

// useSyncExternalStore needs a stable snapshot: cache by the raw stored strings.
let cacheKey = '', cacheUser: User | null = null
export function currentUser(): User | null {
  const key = raw(KEYS.session) + '|' + raw(KEYS.users)
  if (key === cacheKey) return cacheUser
  cacheKey = key
  const s = read<{ userId: string } | null>(KEYS.session, null)
  cacheUser = s ? users().find((u) => u.id === s.userId) ?? null : null
  return cacheUser
}
export function updateProfile(patch: Partial<Omit<User, 'id' | 'phone'>>): User | null {
  const u = currentUser(); return u ? saveUser(patch, u.id) : null
}
export function logout() { try { localStorage.removeItem(KEYS.session) } catch { /* ignore */ } emit() }
export function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb); window.addEventListener('storage', cb)
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) }
}
