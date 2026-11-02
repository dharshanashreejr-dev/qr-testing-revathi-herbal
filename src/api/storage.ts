// Phase 0: the ONE place that touches localStorage for the CRS data.
// BACKEND: every function that uses read/write below becomes a REST call (Spring Boot + MySQL) later.
export const KEYS = {
  users: 'rhbc:users',
  session: 'rhbc:session',
  otp: 'rhbc:otp',
  sms: 'rhbc:sms-outbox',
  bookings: 'rhbc:bookings',
  blocked: 'rhbc:blocked',
  locks: 'rhbc:slot-locks',
  anon: 'rhbc:anon-id',
  invoices: 'rhbc:invoices',
  audit: 'rhbc:audit',
} as const

export function read<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d }
}
export function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage unavailable, demo keeps working in memory */ }
}
export const raw = (k: string): string => { try { return localStorage.getItem(k) ?? '' } catch { return '' } }
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
