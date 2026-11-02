// Festival campaigns, coupons and bundle offers (CRS 4.3).
// BACKEND: `campaigns`, `coupons`, `bundles` tables. validateCoupon() / redeemCoupon() run on the server inside the order
//          transaction (never trust the browser for the discount). The festival SMS goes through the DLT "Promotional"
//          template; the start / end dates drive a scheduled job that activates and expires each offer.
import { read, uid } from './storage'
import { currentUser } from './auth'
import { getBookings } from './booking'
import { heroSlides, type HeroSlide } from '../landing/hero-slides'

export type Scope = 'products' | 'services' | 'both'
export type OfferStatus = 'Scheduled' | 'Active' | 'Expired' | 'Paused'

export interface Campaign { id: string; name: string; pct: number; code: string; scope: Scope; start: string; end: string; active: boolean; used: number; smsSent: number; title?: string; description?: string; banner?: string }
/** Who a coupon is meant for. The rule is checked against the logged-in customer's own orders and bookings.
 *  any              -> every customer (guests too), no history check (admin-created coupons)
 *  first-order      -> customer has never placed a product order            (free delivery)
 *  first-service    -> customer has never booked a service                  (10% off the service)
 *  booked-no-order  -> customer has booked a service but never bought products (free delivery on the first purchase) */
export type CouponRule = 'any' | 'first-order' | 'first-service' | 'booked-no-order'
export interface Coupon { id: string; code: string; type: 'percent' | 'freeship'; value: number; rule: CouponRule; title: string; desc: string; minOrder: number; maxUses: number; used: number; scope: Scope; start: string; end: string; active: boolean }
export interface Bundle { id: string; name: string; service: string; product: string; price: number; start: string; end: string; active: boolean }
interface Data { campaigns: Campaign[]; coupons: Coupon[]; bundles: Bundle[]; removedCampaigns?: string[] }

const OK = 'rhbc:offers-v3'
const seed: Data = {
  // Each campaign has its own banner, title, description and discount (all editable in Admin > Festival & Offers).
  campaigns: [
    { id: 'cmp-1', name: 'Deepavali Glow Offer', title: 'Festive season sale on herbal care', description: 'Hair oils, soaps, face creams and gift sets at festival prices. Free delivery above ₹1,999.', banner: '/assets/hero/hb-festive.jpg', pct: 15, code: 'DEEPAVALI15', scope: 'both', start: '2026-10-01', end: '2026-11-14', active: true, used: 0, smsSent: 0 },
    { id: 'cmp-2', name: 'Pongal Special', title: 'Herbal lipstick gift boxes for the season', description: 'Six herbal shades in one box. A lovely gift for family and friends.', banner: '/assets/hero/hb-seasonal.jpg', pct: 20, code: 'PONGAL20', scope: 'both', start: '2026-10-01', end: '2027-01-18', active: true, used: 0, smsSent: 0 },
    { id: 'cmp-3', name: 'Spa & Facial Packages', title: 'Facials, bridal and spa packages', description: 'Pick a package from our service brochure and book your slot online. Weekday spa offers.', banner: '/assets/hero/hb-service.jpg', pct: 10, code: 'SPA10', scope: 'services', start: '2026-10-01', end: '2026-12-31', active: true, used: 0, smsSent: 0 },
    { id: 'cmp-4', name: 'Daily Combo Deals', title: 'New offers every day', description: 'First order discount, combo deals and free delivery. Buy 2 and save 10%.', banner: '/assets/hero/hb-combo.jpg', pct: 10, code: 'COMBO10', scope: 'products', start: '2026-10-01', end: '2026-12-31', active: true, used: 0, smsSent: 0 },
  ],
  // Three built-in customer coupons (admin can pause them and change the dates / code / usage limit, but not delete them).
  // The admin can also generate any number of new coupons (Admin > Festival & Offers > Coupons > New coupon).
  coupons: [
    { id: 'cpn-first-order', code: 'FIRSTORDER', type: 'freeship', value: 0, rule: 'first-order', title: 'First order: free delivery', desc: 'Customers placing their first product order get free delivery.', minOrder: 0, maxUses: 0, used: 0, scope: 'products', start: '2026-01-01', end: '2026-12-31', active: true },
    { id: 'cpn-first-service', code: 'FIRSTSERVICE10', type: 'percent', value: 10, rule: 'first-service', title: 'First service: 10% off', desc: 'Customers booking a service for the first time get 10% off that service.', minOrder: 0, maxUses: 0, used: 0, scope: 'services', start: '2026-01-01', end: '2026-12-31', active: true },
    { id: 'cpn-booked-ship', code: 'BOOKEDSHIP', type: 'freeship', value: 0, rule: 'booked-no-order', title: 'Booked a service: free delivery', desc: 'Customers who have booked a service but never bought products get free delivery on their first product purchase.', minOrder: 0, maxUses: 0, used: 0, scope: 'products', start: '2026-01-01', end: '2026-12-31', active: true },
  ],
  bundles: [
    { id: 'bun-1', name: 'Glow Ritual Combo', service: 'Normal Facial', product: 'Aurelia Hyaluronic Dew Serum', price: 4199, start: '2026-10-01', end: '2026-12-31', active: true },
    { id: 'bun-2', name: 'New Year Bundle', service: 'Body Massage', product: 'Nuage Whipped Body Butter', price: 4299, start: '2026-12-26', end: '2027-01-05', active: true },
  ],
}
/** The three built-in coupons are fixed by the system: only what the admin may edit (code, dates, usage limit, pause, % value, products / services / both) is read back from storage.
 *  Extra coupons the admin generated are kept as saved. */
const load = (): Data => {
  const st = read<Partial<Data>>(OK, {})
  const coupons = seed.coupons.map((c) => {
    const o = st.coupons?.find((x) => x.id === c.id)
    return o ? { ...c, code: o.code, value: c.type === 'percent' ? o.value : c.value, maxUses: o.maxUses, used: o.used, start: o.start, end: o.end, active: o.active, scope: o.scope ?? c.scope } : c
  })
  const seedCouponIds = new Set(seed.coupons.map((x) => x.id))
  for (const c of st.coupons || []) if (!seedCouponIds.has(c.id)) coupons.push(c) // coupons generated by the admin
  // Always keep all 4 built-in campaigns (merge saved overrides). Older storage often had only 2.
  const byId = new Map((st.campaigns || []).map((c) => [c.id, c]))
  const removedCampaigns = st.removedCampaigns || []
  const campaigns = seed.campaigns.filter((d) => !removedCampaigns.includes(d.id)).map((d) => {
    const c = byId.get(d.id)
    if (!c) return { ...d }
    return {
      ...d,
      ...c,
      title: c.title || d.title,
      description: c.description || d.description,
      // banner === '' means the admin removed it: keep it empty (only a never-saved banner falls back to the default)
      banner: c.banner !== undefined ? c.banner : d.banner,
      name: c.name || d.name,
      code: c.code || d.code,
      pct: c.pct ?? d.pct,
      scope: c.scope || d.scope,
      start: c.start || d.start,
      end: c.end || d.end,
      active: c.active !== undefined ? c.active : d.active,
      used: c.used ?? d.used,
      smsSent: c.smsSent ?? d.smsSent,
    }
  })
  // Keep any extra custom campaigns admin created (not in seed)
  const seedIds = new Set(seed.campaigns.map((x) => x.id))
  for (const c of st.campaigns || []) {
    if (!seedIds.has(c.id)) campaigns.push(c)
  }
  return { campaigns, coupons, bundles: st.bundles ?? seed.bundles, removedCampaigns }
}
/** Returns false when the browser storage is full (big banner images), so the admin page can warn. */
const setItem = (k: string, v: unknown): boolean => { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } }
const save = (d: Data) => setItem(OK, d)

/** Today as YYYY-MM-DD in the browser's local time. */
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const statusOf = (o: { active: boolean; start: string; end: string }): OfferStatus =>
  !o.active ? 'Paused' : today() < o.start ? 'Scheduled' : today() > o.end ? 'Expired' : 'Active'

export const list = () => load()
export const codeTaken = (code: string, exceptId?: string) => {
  const c = code.trim().toUpperCase(), d = load()
  return [...d.campaigns, ...d.coupons].some((x) => x.code === c && x.id !== exceptId)
}
export const newId = (p: 'cmp' | 'cpn' | 'bun') => uid(p)

function upsert<T extends { id: string }>(arr: T[], item: T): T[] { return arr.some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [item, ...arr] }
export const saveCampaign = (c: Campaign): boolean => { const d = load(); return save({ ...d, campaigns: upsert(d.campaigns, { ...c, code: c.code.trim().toUpperCase() }) }) }
export const saveCoupon = (c: Coupon) => { const d = load(); save({ ...d, coupons: upsert(d.coupons, { ...c, code: c.code.trim().toUpperCase() }) }) }
export const saveBundle = (b: Bundle) => { const d = load(); save({ ...d, bundles: upsert(d.bundles, b) }) }
export const removeOffer = (kind: 'campaign' | 'coupon' | 'bundle', id: string) => {
  const d = load()
  save(kind === 'campaign' ? { ...d, campaigns: d.campaigns.filter((x) => x.id !== id), removedCampaigns: [...(d.removedCampaigns || []), id] } : kind === 'coupon' ? { ...d, coupons: d.coupons.filter((x) => x.id !== id) } : { ...d, bundles: d.bundles.filter((x) => x.id !== id) })
}
export const markSmsSent = (id: string, n: number) => { const d = load(); save({ ...d, campaigns: d.campaigns.map((c) => (c.id === id ? { ...c, smsSent: c.smsSent + n } : c)) }) }

export type CouponReason = 'empty' | 'invalid' | 'inactive' | 'early' | 'expired' | 'scope' | 'used-up' | 'min' | 'login' | 'not-first-order' | 'not-first-service' | 'need-booking' | 'has-order'
/** discount = rupees off the subtotal; freeShip = the delivery charge is waived. */
export type CouponResult = { ok: true; code: string; label: string; discount: number; freeShip: boolean } | { ok: false; reason: CouponReason; min?: number }

const ORDERS_KEY = 'VELVET TOUCH-orders' // same key the tracking page / saveOrder.ts uses
/** Product orders this customer has already placed (cancelled ones do not count). */
const orderCount = (userId: string) => read<{ userId?: string; cancelled?: boolean }[]>(ORDERS_KEY, []).filter((o) => o.userId === userId && !o.cancelled).length
/** Service bookings this customer has already made (cancelled / rejected ones do not count). */
const bookingCount = (userId: string) => getBookings().filter((b) => b.userId === userId && b.status !== 'Cancelled' && b.status !== 'Rejected').length

/** Checks a code typed by the customer. Campaign codes work like percent coupons during their dates. */
export function validateCoupon(code: string, subtotal: number, forScope: 'products' | 'services' = 'products'): CouponResult {
  const c = code.trim().toUpperCase()
  if (!c) return { ok: false, reason: 'empty' }
  const d = load()
  const cp = d.coupons.find((x) => x.code === c)
  const ca = d.campaigns.find((x) => x.code === c)
  const item = cp ?? ca
  if (!item) return { ok: false, reason: 'invalid' }
  if (!item.active) return { ok: false, reason: 'inactive' }
  if (today() < item.start) return { ok: false, reason: 'early' }
  if (today() > item.end) return { ok: false, reason: 'expired' }
  if (item.scope !== 'both' && item.scope !== forScope) return { ok: false, reason: 'scope' }
  if (cp) {
    if (cp.maxUses > 0 && cp.used >= cp.maxUses) return { ok: false, reason: 'used-up' }
    if (subtotal < cp.minOrder) return { ok: false, reason: 'min', min: cp.minOrder }
    // Customer-type rules. BACKEND: the server runs the same check on the customer's real order / booking history.
    if (cp.rule !== 'any') {
      const me = currentUser()
      if (!me) return { ok: false, reason: 'login' }
      const orders = orderCount(me.id), bookings = bookingCount(me.id)
      if (cp.rule === 'first-order' && orders > 0) return { ok: false, reason: 'not-first-order' }
      if (cp.rule === 'first-service' && bookings > 0) return { ok: false, reason: 'not-first-service' }
      if (cp.rule === 'booked-no-order') {
        if (bookings === 0) return { ok: false, reason: 'need-booking' }
        if (orders > 0) return { ok: false, reason: 'has-order' }
      }
    }
    if (cp.type === 'freeship') return { ok: true, code: c, label: 'Free delivery', discount: 0, freeShip: true }
    return { ok: true, code: c, label: `${cp.value}%`, discount: Math.round((subtotal * cp.value) / 100), freeShip: false }
  }
  return { ok: true, code: c, label: `${ca!.pct}%`, discount: Math.round((subtotal * ca!.pct) / 100), freeShip: false }
}
/** Counts one use after the order is placed. */
export function redeemCoupon(code: string) {
  const c = code.trim().toUpperCase(), d = load()
  save({ ...d, coupons: d.coupons.map((x) => (x.code === c ? { ...x, used: x.used + 1 } : x)), campaigns: d.campaigns.map((x) => (x.code === c ? { ...x, used: x.used + 1 } : x)) })
}

// ---------------------------------------------------------------------------------------------
// Live offers shown on the customer website: service cards, product cards, the booking page and checkout.
// Everything comes from Admin > Festival & Offers (coupons + festival campaigns), so pausing an offer or changing its dates
// there changes what customers see straight away. Only offers that are Active today (and not used up) are returned.
// BACKEND: GET /api/offers?scope=services|products (server decides which offers are live).
// ---------------------------------------------------------------------------------------------
export interface OfferView { id: string; kind: 'coupon' | 'campaign'; code: string; title: string; desc: string; type: 'percent' | 'freeship'; value: number; scope: Scope; end: string; daysLeft: number }
const dayDiff = (to: string) => Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${today()}T00:00:00`)) / 864e5)
export function liveOffers(forScope: 'products' | 'services'): OfferView[] {
  const d = load(), out: OfferView[] = []
  d.coupons.forEach((c) => {
    if (statusOf(c) !== 'Active' || (c.scope !== 'both' && c.scope !== forScope) || (c.maxUses > 0 && c.used >= c.maxUses)) return
    out.push({ id: c.id, kind: 'coupon', code: c.code, title: c.title, desc: c.desc, type: c.type, value: c.type === 'percent' ? c.value : 0, scope: c.scope, end: c.end, daysLeft: dayDiff(c.end) })
  })
  // Festival campaigns (Pongal, Deepavali...) are not listed here: product cards and service cards show the admin Coupons only.
  return out.sort((a, b) => (a.type === b.type ? b.value - a.value : a.type === 'percent' ? -1 : 1))
}

// ---------------------------------------------------------------------------------------------
// Banners, brochures and festive images (admin controlled).
// The customer website shows: default hero slides (src/landing/hero-slides.ts) + live festival-campaign banners
// + images the admin added. Admin can replace or delete any of them. Stored in localStorage for now.
// BACKEND: `banners` table (id, kind, title, image_url, active) + file upload endpoint; delete = soft delete.
// ---------------------------------------------------------------------------------------------
export type GalleryKind = 'festive' | 'seasonal' | 'brochure' | 'daily' | 'banner'
export interface GalleryItem { id: string; kind: GalleryKind; title: string; image: string; badge: string; source: 'default' | 'custom' | 'campaign' | 'shop' }
interface AddedImage { id: string; kind: GalleryKind; title: string; image: string }
interface GalleryData { removed: string[]; replaced: Record<string, string>; added: AddedImage[] }

const GK = 'rhbc:gallery'
const loadG = (): GalleryData => ({ removed: [], replaced: {}, added: [], ...read<Partial<GalleryData>>(GK, {}) })
const saveG = (g: GalleryData) => setItem(GK, g)

/** Banners on the shop page (src/products/components/HeroBanner.tsx). */
export const SHOP_BANNERS = [
  { id: 'b1', image: '/assets/banners/pb-best-sellers.webp', title: 'Best sellers banner' },
  { id: 'b2', image: '/assets/banners/pb-combos.webp', title: 'Combos banner' },
]
const CAMP_PREFIX = 'camp:'

export function galleryItems(): GalleryItem[] {
  const g = loadG(), d = load()
  const items: GalleryItem[] = []
  d.campaigns.forEach((c) => {
    // Paused campaigns keep their banner (only the hover text is hidden); expired / scheduled ones do not appear
    if (c.banner && (statusOf(c) === 'Active' || statusOf(c) === 'Paused')) {
      items.push({ id: CAMP_PREFIX + c.id, kind: 'festive', title: c.title || c.name, image: c.banner, badge: `${c.pct}% OFF`, source: 'campaign' })
    }
  })
  heroSlides.forEach((s) => {
    if (!g.removed.includes(s.id)) items.push({ id: s.id, kind: s.id, title: s.title.en, image: g.replaced[s.id] || s.image, badge: s.badge.en, source: 'default' })
  })
  g.added.forEach((a) => items.push({ id: a.id, kind: a.kind, title: a.title, image: a.image, badge: '', source: 'custom' }))
  SHOP_BANNERS.forEach((b) => {
    if (!g.removed.includes(b.id)) items.push({ id: b.id, kind: 'banner', title: b.title, image: g.replaced[b.id] || b.image, badge: '', source: 'shop' })
  })
  return items
}

export function addGalleryImage(kind: GalleryKind, title: string, image: string): boolean {
  const g = loadG()
  return saveG({ ...g, added: [...g.added, { id: uid('img'), kind, title, image }] })
}
export function replaceGalleryImage(id: string, image: string): boolean {
  if (id.startsWith(CAMP_PREFIX)) {
    const c = load().campaigns.find((x) => x.id === id.slice(CAMP_PREFIX.length))
    return c ? saveCampaign({ ...c, banner: image }) : false
  }
  const g = loadG()
  if (g.added.some((a) => a.id === id)) return saveG({ ...g, added: g.added.map((a) => (a.id === id ? { ...a, image } : a)) })
  return saveG({ ...g, replaced: { ...g.replaced, [id]: image } })
}
export function removeGalleryItem(id: string): boolean {
  if (id.startsWith(CAMP_PREFIX)) {
    const c = load().campaigns.find((x) => x.id === id.slice(CAMP_PREFIX.length))
    return c ? saveCampaign({ ...c, banner: '' }) : false
  }
  const g = loadG()
  if (g.added.some((a) => a.id === id)) return saveG({ ...g, added: g.added.filter((a) => a.id !== id) })
  const rest = { ...g.replaced }
  delete rest[id]
  return saveG({ ...g, replaced: rest, removed: [...g.removed, id] })
}
export const galleryHasChanges = () => { const g = loadG(); return g.removed.length > 0 || Object.keys(g.replaced).length > 0 }
/** Brings back the built-in banners the admin deleted or replaced (images the admin added are kept). */
export const restoreGalleryDefaults = () => { const g = loadG(); saveG({ ...g, removed: [], replaced: {} }) }

/** Slides for the customer home page hero: live campaign banners first, then the rest. */
export function liveHeroSlides(): HeroSlide[] {
  const g = loadG(), d = load()
  const mk = (id: string, image: string, title: string, badge: string, copy: string, kind: string): HeroSlide => ({
    id: id as HeroSlide['id'], image, width: 1920, height: 823, tone: '#F4E8CF', action: 'shop-all',
    kind: { en: kind }, badge: { en: badge }, title: { en: title }, copy: { en: copy }, cta: { en: 'Shop now' }, alt: { en: title },
  })
  // Active campaigns show banner + hover text. Paused campaigns keep the banner but lose the hover text (copy = '').
  // Only deleting a campaign (or it being Scheduled / Expired) removes the banner.
  const camps = d.campaigns
    .filter((c) => c.banner && (statusOf(c) === 'Active' || statusOf(c) === 'Paused'))
    .map((c) => mk(CAMP_PREFIX + c.id, c.banner as string, c.title || c.name, `${c.pct}% OFF`, statusOf(c) === 'Paused' ? '' : c.description || '', 'Festive offer'))
  // The built-in slides are the same pictures as the 4 campaigns, so campaigns (Active only) replace them.
  // Paused / scheduled / expired / deleted campaigns must never come back through the defaults (and their hover text).
  const fallback: HeroSlide[] = camps.length || g.added.length ? [] : [mk('default-banner', '/assets/banners/pb-best-sellers.webp', 'Revathi Herbal Beauty Care', '', '', 'daily')]
  const base = fallback
  const extra = g.added.map((a) => mk(a.id, a.image, a.title, '', '', a.kind))
  return [...camps, ...base, ...extra]
}

/** Slides for the shop page banner. */
export function liveShopBanners(): { src: string; alt: string }[] {
  const g = loadG()
  return SHOP_BANNERS.filter((b) => !g.removed.includes(b.id)).map((b) => ({ src: g.replaced[b.id] || b.image, alt: b.title }))
}
