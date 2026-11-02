import { getSiteConfig, promoPrice } from '../shared/siteConfig'
import { team, type Category } from '../api/catalog'

export { team }
export type { Category }

export interface Service { id: string; name: string; category: Category; duration: number; price: number; basePrice?: number; promo?: string; care?: string; img: string; desc: string; popular?: boolean; signature?: boolean }

export const spa = {
  name: 'REVATHI HERBAL BEAUTY CARE', sub: 'WOMEN\'S LUXURY SALON', short: 'WOMEN\'S LUXURY SALON', phone: '+91 90000 00000', email: 'hello@revathiherbal.com',
  address: '24 Lotus Garden Road, City Centre', hours: [['Monday – Friday', '9:00 am – 9:00 pm'], ['Saturday', '9:00 am – 10:00 pm'], ['Sunday', '10:00 am – 8:00 pm']],
}
export const categories: ('All' | Category)[] = ['All', 'Body Massage', 'Facial', 'Consultation', 'Bridal Makeup']
export const amenities = ['Women-only luxury space', 'Private treatment suites', 'Herbal tea bar', 'Lockers & fresh towels', 'Free parking', 'Vegan & organic products', 'Wheelchair accessible']
export const policies = ['Arrive 10 minutes early to unwind', 'Free rescheduling up to 12 hours before', 'Please share allergies or injuries in the notes', 'Gift cards available at reception']

// Normal services and consultations are edited by the admin (admin panel -> Services & Pricing). `price` is the price AFTER the
// active promotional discount; `basePrice` is the base fee, shown struck through when a promo is running.
const SERVICE_IMG: Record<string, string> = {
  'body-massage': 'head-massage', 'normal-facial': 'facial', 'hydra-facial': 'hydra-facial', 'herbal-glow-facial': 'herbal-mask',
  'brightening-facial': 'facial2', 'anti-ageing-facial': 'back', 'beauty-consultation': 'reception',
}
// Bridal packages: one picture each (a value starting with / is a full image path).
const BRIDAL_IMG: Record<string, string> = { 'bridal-silver': 'bridal-veil', 'bridal-gold': 'bridal-saree', 'bridal-platinum': '/assets/services-hero/sh-bridal.webp', 'bridal-trial': 'close' }
const promoTag = (type?: 'flat' | 'percent', v = 0) => (v > 0 ? (type === 'flat' ? `₹${v} off` : `${v}% off`) : undefined)
const baseServices = (): Service[] => getSiteConfig().services.filter((s) => s.active).map((s) => ({
  id: s.id, name: s.name, category: s.category as Category, duration: s.duration, price: promoPrice(s.price, s.discountType, s.discountValue),
  basePrice: s.discountValue > 0 ? s.price : undefined, promo: promoTag(s.discountType, s.discountValue), care: s.care || undefined,
  img: SERVICE_IMG[s.id] ?? 'facial', popular: s.popular, signature: s.signature, desc: s.desc,
}))
// Bridal makeup packages are edited by the admin too.
const bridalServices = (): Service[] => getSiteConfig().bridalPackages.map((b) => ({
  id: b.id, name: `Bridal Makeup – ${b.name}`, category: 'Bridal Makeup' as Category, duration: b.duration,
  price: promoPrice(b.price, b.discountType, b.discountValue), basePrice: (b.discountValue ?? 0) > 0 ? b.price : undefined, promo: promoTag(b.discountType, b.discountValue), care: b.care || undefined,
  img: BRIDAL_IMG[b.id] ?? 'bridal-saree', popular: b.popular, desc: b.features.join(' · '),
}))
export const services: Service[] = [...baseServices(), ...bridalServices()]
/** Always-fresh list (includes services the admin added after the page loaded). */
export const liveServices = (): Service[] => [...baseServices(), ...bridalServices()]

/** Admin switch: service prices are hidden on the public site unless the admin turns them on. */
export const servicePricesVisible = () => getSiteConfig().showServicePrices
export const img = (k: string) => (k.startsWith('/') ? k : `/img/${k}.jpg`)
const moneyLocale = () => { try { const l = localStorage.getItem('velvet-lang'); return ({ en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN', ml: 'ml-IN', te: 'te-IN' } as Record<string,string>)[l || 'en'] || 'en-IN' } catch { return 'en-IN' } }
export const money = (n: number) => '₹' + n.toLocaleString(moneyLocale())

