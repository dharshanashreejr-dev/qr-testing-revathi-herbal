// Admin edits on top of the shop catalogue (CRS 4.1): price / discount columns, archive, product photo, and products added by admin.
// The shop (src/products/data/products.ts) reads these live, so Admin Products and the customer shop use ONE catalogue.
// BACKEND: `products` table (+ `product_images` on object storage); archive = `archived_at` column, never a hard delete.
import { read, write } from './storage'

export type DiscountType = 'flat' | 'percent'
export type ProductStatus = 'Active' | 'Draft'
export interface Patch { name?: string; description?: string; mrp?: number; price?: number; discountType?: DiscountType; discountValue?: number; status?: ProductStatus; archived?: boolean; image?: string; availability?: 'in' | 'out' }
export interface Added { id: string; sku: string; category: 'face' | 'wellness products' | 'body'; subcategory: string; name: string; description: string; mrp: number; price: number; stock: number }

const PK = 'rhbc:catalogue-patches', AK = 'rhbc:catalogue-added', EVT = 'rhbc-catalogue-change'
let cacheRaw: string | null = null, cache: Record<string, Patch> = {}
const patches = (): Record<string, Patch> => {
  let raw: string | null = null
  try { raw = localStorage.getItem(PK) } catch { /* no storage */ }
  if (raw !== cacheRaw) { cacheRaw = raw; try { cache = raw ? JSON.parse(raw) : {} } catch { cache = {} } }
  return cache
}
const emit = () => { try { window.dispatchEvent(new Event(EVT)) } catch { /* no window */ } }

export const getPatch = (id: string): Patch => patches()[id] ?? {}
export function setPatch(id: string, patch: Patch) { write(PK, { ...read<Record<string, Patch>>(PK, {}), [id]: { ...getPatch(id), ...patch } }); emit() }
export const getAdded = () => read<Added[]>(AK, [])
export function saveAdded(a: Added) { write(AK, [a, ...getAdded().filter((x) => x.id !== a.id)]); emit() }
export function subscribe(cb: () => void) { window.addEventListener(EVT, cb); window.addEventListener('storage', cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) } }

/** Shrinks an uploaded photo to a small JPEG data URL so it fits browser storage. BACKEND: upload the file to object storage and keep the URL. */
export function compressImage(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { reject(new Error('type')); return }
    if (file.size > 8 * 1024 * 1024) { reject(new Error('size')); return }
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('read')) }
    img.src = url
  })
}
