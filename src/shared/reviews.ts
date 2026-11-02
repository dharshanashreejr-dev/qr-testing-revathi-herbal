import { useSyncExternalStore } from 'react'

// Customer reviews for products and services. Stored in localStorage and shown in the admin panel.
export interface Review {
  id: string
  kind: 'product' | 'service'
  targetId: string
  targetName: string
  name: string
  rating: number
  text: string
  at: number
  uid?: string
}

const KEY = 'revathi-reviews'
const EVT = 'revathi-reviews-change'

const SEED: Review[] = [
  { id: 'seed-1', kind: 'service', targetId: 'normal-facial', targetName: 'Normal Facial', name: 'Priya V.', rating: 5, text: 'My skin felt fresh and soft. The staff were so kind.', at: Date.UTC(2026, 8, 20) },
  { id: 'seed-2', kind: 'service', targetId: 'body-massage', targetName: 'Body Massage', name: 'Anitha R.', rating: 5, text: 'Very relaxing herbal oil massage in a private room.', at: Date.UTC(2026, 8, 25) },
]

let cache: { raw: string | null; value: Review[] } | null = null
function read(): Review[] {
  let raw: string | null = null
  try { raw = localStorage.getItem(KEY) } catch {}
  if (cache && cache.raw === raw) return cache.value
  let value = SEED
  if (raw) { try { const p = JSON.parse(raw); if (Array.isArray(p)) value = p } catch {} }
  cache = { raw, value }
  return value
}
function write(list: Review[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
  window.dispatchEvent(new Event(EVT))
}
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb); window.addEventListener('storage', cb)
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) }
}

export const useReviews = (): Review[] => useSyncExternalStore(subscribe, read, () => SEED)
export const getReviews = read

export function addReview(r: Omit<Review, 'id' | 'at'>) {
  write([{ ...r, id: 'rv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now() }, ...read()])
}
export const deleteReview = (id: string) => write(read().filter((r) => r.id !== id))
