import { useSyncExternalStore } from 'react'

// Site-wide settings the ADMIN controls (admin panel -> "Services & Pricing").
// Stored in localStorage so the public pages (landing, services, booking) pick them up.

export interface BridalPackage {
  id: string
  name: string          // Silver | Gold | Platinum | Trial Pack
  price: number
  duration: number      // minutes
  features: string[]
  popular?: boolean
  discountType?: DiscountType // active promotional discount (CRS 4.2)
  discountValue?: number
  care?: string               // pre-service care instructions
}
export type DiscountType = 'flat' | 'percent'
/** A normal service or consultation the admin manages (CRS 4.2). BACKEND: `services` table. */
export interface ServiceItem {
  id: string
  name: string
  category: 'Body Massage' | 'Facial' | 'Consultation'
  duration: number      // minutes
  price: number         // base service fee
  discountType: DiscountType
  discountValue: number // 0 = no promo
  care: string          // pre-service care instructions
  desc: string
  active: boolean       // inactive = hidden from the website and booking
  popular?: boolean
  signature?: boolean   // shows the "Our signature service" badge on the service card
}
export interface SiteConfig {
  showServicePrices: boolean
  bridalPackages: BridalPackage[]
  services: ServiceItem[]
}
/** Price after the active promotional discount. */
export const promoPrice = (price: number, type: DiscountType = 'percent', value = 0) =>
  Math.max(0, Math.round(type === 'percent' ? price - (price * value) / 100 : price - value))
export const promoLabel = (type: DiscountType = 'percent', value = 0) => (value > 0 ? (type === 'percent' ? `${value}% off` : `₹${value} off`) : '')

export const DEFAULT_BRIDAL: BridalPackage[] = [
  { id: 'bridal-silver', name: 'Silver', price: 12000, duration: 150, features: ['HD bridal makeup', 'Simple hairstyle', 'Saree / dupatta draping', 'Basic skin prep'] },
  { id: 'bridal-gold', name: 'Gold', price: 22000, duration: 180, popular: true, features: ['HD / airbrush bridal makeup', 'Premium hairstyle with accessories', 'Saree draping', 'Pre-wedding skin prep', 'Touch-up kit'] },
  { id: 'bridal-platinum', name: 'Platinum', price: 35000, duration: 240, features: ['Airbrush bridal makeup', 'Designer hairstyle', 'Draping & jewellery setting', 'Full skin prep facial', 'Mother-of-bride mini makeup', 'Touch-up kit'] },
  { id: 'bridal-trial', name: 'Trial Pack', price: 3500, duration: 90, features: ['Full bridal look trial', 'Hairstyle trial', 'Look & product consultation', 'Photo for reference'] },
]

export const DEFAULT_SERVICES: ServiceItem[] = [
  { id: 'body-massage', name: 'Body Massage', category: 'Body Massage', duration: 60, price: 2800, discountType: 'percent', discountValue: 0, care: 'Avoid a heavy meal 1 hour before. Share any injuries or allergies.', desc: 'A calming full-body massage with warm herbal oils, made for women to unwind in our private suites.', active: true, popular: true },
  { id: 'normal-facial', name: 'Normal Facial', category: 'Facial', duration: 60, price: 2200, discountType: 'percent', discountValue: 0, care: 'Come with a clean face. Avoid threading or waxing 2 days before.', desc: 'Cleanse, gentle exfoliation, massage and a glow mask for fresh, healthy-looking skin.', active: true, popular: true },
  { id: 'hydra-facial', name: 'Hydra Facial', category: 'Facial', duration: 75, price: 3200, discountType: 'percent', discountValue: 0, care: 'Skip exfoliating products for 3 days before. Tell us about any skin allergies.', desc: 'Deep cleansing and intense hydration for a fresher, brighter, smoother look.', active: true },
  { id: 'herbal-glow-facial', name: 'Herbal Glow Facial', category: 'Facial', duration: 60, price: 2400, signature: true, discountType: 'percent', discountValue: 0, care: 'Come with a clean face. Tell us about any skin allergies.', desc: 'A herbal-infused facial that cleanses, nourishes and leaves skin with a natural glow.', active: true },
  { id: 'brightening-facial', name: 'Brightening Facial', category: 'Facial', duration: 60, price: 2800, discountType: 'percent', discountValue: 0, care: 'Avoid threading or waxing 2 days before.', desc: 'A vitamin-rich cleanse and mask that evens out tone and brightens dull skin.', active: true },
  { id: 'anti-ageing-facial', name: 'Anti-Ageing Facial', category: 'Facial', duration: 75, price: 3600, discountType: 'percent', discountValue: 0, care: 'Skip exfoliating products for 3 days before.', desc: 'Firming massage and a peptide-rich mask to soften fine lines and lift tired skin.', active: true },
  { id: 'beauty-consultation', name: 'Beauty Consultation', category: 'Consultation', duration: 30, price: 500, discountType: 'percent', discountValue: 0, care: 'Bring the skincare products you use now, if possible.', desc: 'A one-to-one session with our beauty expert to plan the right skin and beauty routine for you.', active: true },
]

export const DEFAULT_CONFIG: SiteConfig = { showServicePrices: false, bridalPackages: DEFAULT_BRIDAL, services: DEFAULT_SERVICES }

const KEY = 'revathi-site-config'
const EVT = 'revathi-config-change'

let cache: { raw: string | null; value: SiteConfig } | null = null

function read(): SiteConfig {
  let raw: string | null = null
  try { raw = localStorage.getItem(KEY) } catch {}
  if (cache && cache.raw === raw) return cache.value
  let value = DEFAULT_CONFIG
  if (raw) {
    try {
      const p = JSON.parse(raw)
      value = {
        showServicePrices: !!p.showServicePrices,
        bridalPackages: Array.isArray(p.bridalPackages) && p.bridalPackages.length ? p.bridalPackages : DEFAULT_BRIDAL,
        services: Array.isArray(p.services) && p.services.length ? p.services : DEFAULT_SERVICES,
      }
    } catch {}
  }
  cache = { raw, value }
  return value
}

export const getSiteConfig = (): SiteConfig => read()

export function saveSiteConfig(next: SiteConfig) {
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  window.dispatchEvent(new Event(EVT))
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) }
}

export function useSiteConfig(): SiteConfig {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_CONFIG)
}
