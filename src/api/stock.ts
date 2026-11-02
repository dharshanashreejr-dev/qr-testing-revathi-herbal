// Stock rules + "Notify Me via SMS" requests (CRS 3.2 / 4.1).
// BACKEND: notify requests -> table; fulfil() runs when stock goes from 0 to >0; threshold comes from admin settings.
import { read, write, raw } from './storage'
import { sendSms } from './sms'

export const LOW_STOCK_DEFAULT = 10 // admin makes this configurable in Phase 4
export type StockState = 'in' | 'low' | 'out'
export const stockState = (stock: number, threshold = getThreshold()): StockState => (stock <= 0 ? 'out' : stock <= threshold ? 'low' : 'in')

const NK = 'rhbc:notify'
export interface NotifyRequest { productId: string; productName: string; phone: string; at: string }
export const getRequests = () => read<NotifyRequest[]>(NK, [])
export const hasRequest = (productId: string, phone: string) => getRequests().some((r) => r.productId === productId && r.phone === phone)
export function requestNotify(productId: string, productName: string, phone: string) {
  if (!hasRequest(productId, phone)) write(NK, [...getRequests(), { productId, productName, phone, at: new Date().toISOString() }])
}
/** Called when a product is restocked: sends the "back in stock" SMS to everyone waiting, then clears them. */
export function fulfil(productId: string, link: string): number {
  const all = getRequests(), mine = all.filter((r) => r.productId === productId)
  mine.forEach((r) => sendSms('backInStock', r.phone, [r.productName, link]))
  write(NK, all.filter((r) => r.productId !== productId))
  return mine.length
}

// ---- Phase 4a: inventory. Stock levels and settings are shared by the admin Inventory screen and the customer shop.
// BACKEND: `inventory` table (+ stock movements), `settings` table; adjustStock() = one transaction that also queues the
//          back-in-stock and low-stock SMS jobs. The shop must read stock from the API, never trust the browser.
const SK = 'rhbc:stock', ST = 'rhbc:inv-settings', EVT = 'rhbc-stock-change'
export interface InvSettings { lowStockThreshold: number; alertPhone: string }
export function getSettings(): InvSettings { return { lowStockThreshold: LOW_STOCK_DEFAULT, alertPhone: '', ...read<Partial<InvSettings>>(ST, {}) } }
export const getThreshold = () => getSettings().lowStockThreshold
export function saveSettings(patch: Partial<InvSettings>) { write(ST, { ...getSettings(), ...patch }); emit() }

type Over = Record<string, { stock: number; capacity: number }>
const overrides = () => read<Over>(SK, {})
const emit = () => { try { window.dispatchEvent(new Event(EVT)) } catch { /* no window */ } }
/** Stock set from admin (undefined = nobody changed it yet, use the catalogue number). */
export const stockOverride = (id: string): number | undefined => overrides()[id]?.stock
export const capacityOverride = (id: string): number | undefined => overrides()[id]?.capacity
export const waitingCount = (productId: string) => getRequests().filter((r) => r.productId === productId).length

// Standard reason tags for every manual stock change (CRS 4.1). BACKEND: `stock_movements.reason` enum + free-text note.
export const REASONS = ['Damaged', 'In-Parlour Usage', 'Stock Audit Correction', 'New Stock Received'] as const
export type Reason = (typeof REASONS)[number]
export interface StockMove { id: string; at: string; productId: string; sku: string; name: string; prev: number; next: number; reason: Reason; note: string; by: string; role: string }
const MK = 'rhbc:stock-moves'
export const moves = (productId?: string, limit = 50): StockMove[] => read<StockMove[]>(MK, []).filter((m) => !productId || m.productId === productId).slice(0, limit)

export interface AdjustResult { prev: number; next: number; notified: number; lowAlert: boolean }
/** Sets a product's stock. 0 -> above 0 sends the back-in-stock SMS; dropping to the threshold or below sends the low-stock alert. */
export function adjustStock(p: { id: string; sku: string; name: string }, base: number, next: number, link = '', why?: { reason: Reason; note?: string; by?: string; role?: string }): AdjustResult {
  const prev = stockOverride(p.id) ?? base, th = getThreshold(), all = overrides()
  all[p.id] = { stock: Math.max(0, Math.round(next)), capacity: Math.max(all[p.id]?.capacity ?? base, base, next) }
  write(SK, all)
  const notified = prev === 0 && next > 0 ? fulfil(p.id, link || (typeof location !== 'undefined' ? `${location.origin}/products/` : '/products/')) : 0
  const lowAlert = prev > th && next <= th
  if (lowAlert) sendSms('lowStock', getSettings().alertPhone || 'Admin', [p.sku, next])
  if (why && prev !== next) write(MK, [{ id: `mv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: new Date().toISOString(), productId: p.id, sku: p.sku, name: p.name, prev, next: Math.max(0, Math.round(next)), reason: why.reason, note: (why.note || '').trim(), by: why.by || 'Admin', role: why.role || 'Admin' }, ...read<StockMove[]>(MK, [])].slice(0, 300))
  emit()
  return { prev, next, notified, lowAlert }
}
export function subscribe(cb: () => void) { window.addEventListener(EVT, cb); window.addEventListener('storage', cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) } }
export const snapshotKey = () => raw(SK) + '|' + raw(ST) + '|' + raw(NK)
