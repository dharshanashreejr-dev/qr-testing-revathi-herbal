// Velvet Touch product catalogue (sample data). Swap photos in /public/img/ (keys below) with real product photography.
export type PCat = 'Skincare' | 'Body' | 'Hair' | 'Candles & Mists' | 'Gift Sets'
export interface Product {
  id: string; name: string; category: PCat; price: number; sizes: string[]; img: string; gallery: string[]
  tagline: string; desc: string; notes: string[]; how: string; badge?: string; rating: number; reviews: number
}
export const pcats: ('All' | PCat)[] = ['All', 'Skincare', 'Body', 'Hair', 'Candles & Mists', 'Gift Sets']

export const products: Product[] = [
  { id: 'rose-serum', name: 'Velvet Rose Glow Serum', category: 'Skincare', price: 3450, sizes: ['30 ml', '50 ml'], img: 'facial', gallery: ['facial', 'facial2', 'close'], badge: 'Bestseller', rating: 4.9, reviews: 812,
    tagline: 'Liquid silk for a lit-from-within glow.', desc: 'Damask rose, hyaluronic acid and niacinamide in a feather-light serum that plumps, brightens and evens tone in two weeks.', notes: ['Damask rose', 'Hyaluronic acid', 'Niacinamide'], how: 'Press 3 drops into clean skin, morning and night, before moisturiser.' },
  { id: 'gold-cream', name: '24K Gold Renewal Cream', category: 'Skincare', price: 5900, sizes: ['50 ml'], img: 'facial2', gallery: ['facial2', 'facial', 'wide'], badge: 'Signature', rating: 4.8, reviews: 540,
    tagline: 'A night cream worth the ritual.', desc: 'Micro-fine gold, peptides and squalane work while you sleep to firm, smooth and restore elasticity.', notes: ['Gold particles', 'Peptide complex', 'Squalane'], how: 'Warm a pea-sized amount between fingertips, press over face and neck at night.' },
  { id: 'clay-mask', name: 'Himalayan Clay Detox Mask', category: 'Skincare', price: 2200, sizes: ['75 g', '150 g'], img: 'close', gallery: ['close', 'facial2', 'back'], rating: 4.7, reviews: 389,
    tagline: 'Pores refined. Skin reset.', desc: 'Mineral-rich glacial clay with green tea draws out impurities while leaving skin calm, never tight.', notes: ['Glacial clay', 'Green tea', 'Aloe'], how: 'Apply an even layer, leave for 10 minutes, rinse with warm water. Twice weekly.' },
  { id: 'cleansing-balm', name: 'Petal Melt Cleansing Balm', category: 'Skincare', price: 1950, sizes: ['100 ml'], img: 'foot2', gallery: ['foot2', 'facial', 'reception'], rating: 4.8, reviews: 297,
    tagline: 'Melts makeup into a silky milk.', desc: 'A buttery balm that dissolves makeup and SPF, then rinses clean with a soft, petal-scented finish.', notes: ['Rose petal oil', 'Shea butter', 'Vitamin E'], how: 'Massage onto dry skin, add water to emulsify, rinse.' },
  { id: 'body-oil', name: 'Sandalwood Amber Body Oil', category: 'Body', price: 2750, sizes: ['100 ml', '200 ml'], img: 'back', gallery: ['back', 'close', 'wide'], badge: 'Spa favourite', rating: 4.9, reviews: 655,
    tagline: 'The oil from our treatment rooms.', desc: 'The very blend used in our Abhyanga ritual: warm sandalwood, sweet almond and amber for a dry-oil finish.', notes: ['Mysore sandalwood', 'Sweet almond', 'Amber'], how: 'Smooth over damp skin after bathing.' },
  { id: 'salt-scrub', name: 'Himalayan Salt Body Polish', category: 'Body', price: 2100, sizes: ['250 g', '500 g'], img: 'wide', gallery: ['wide', 'back', 'close'], rating: 4.6, reviews: 241,
    tagline: 'Silk skin in one shower.', desc: 'Fine pink salt crystals and cold-pressed oils buff away dullness and leave a lasting veil of softness.', notes: ['Pink salt', 'Coconut oil', 'Jasmine'], how: 'Massage over wet skin in circular motions, rinse well.' },
  { id: 'hand-cream', name: 'Lavender Hand & Foot Butter', category: 'Body', price: 1450, sizes: ['75 ml'], img: 'foot', gallery: ['foot', 'foot2', 'reception'], rating: 4.7, reviews: 318,
    tagline: 'Soft hands. Slower evenings.', desc: 'A rich, non-greasy butter with lavender and shea that repairs dry hands and heels overnight.', notes: ['Lavender', 'Shea butter', 'Glycerin'], how: 'Apply generously to hands and feet before bed.' },
  { id: 'hair-elixir', name: 'Argan Silk Hair Elixir', category: 'Hair', price: 2650, sizes: ['50 ml', '100 ml'], img: 'reception', gallery: ['reception', 'facial2', 'back'], badge: 'New', rating: 4.8, reviews: 176,
    tagline: 'Frizz gone. Shine on.', desc: 'Argan, camellia and bond-repair complex seal split ends and add a mirror shine without weight.', notes: ['Argan oil', 'Camellia', 'Bond-repair complex'], how: 'Warm 2 pumps in palms, smooth through damp or dry lengths.' },
  { id: 'scalp-ritual', name: 'Ayurvedic Scalp Ritual Oil', category: 'Hair', price: 1850, sizes: ['100 ml'], img: 'back', gallery: ['back', 'reception', 'close'], rating: 4.7, reviews: 203,
    tagline: 'Growth begins at the root.', desc: 'Bhringraj, amla and rosemary infused in cold-pressed sesame to nourish the scalp and strengthen strands.', notes: ['Bhringraj', 'Amla', 'Rosemary'], how: 'Massage into scalp, leave for 30 minutes or overnight, then shampoo.' },
  { id: 'candle', name: 'Velvet Hour Soy Candle', category: 'Candles & Mists', price: 2300, sizes: ['220 g'], img: 'wide', gallery: ['wide', 'reception', 'close'], badge: 'Limited', rating: 4.9, reviews: 420,
    tagline: '45 hours of our spa lobby.', desc: 'Hand-poured soy wax with notes of oud, vanilla and white tea in a gold-trimmed amber vessel.', notes: ['Oud', 'Vanilla', 'White tea'], how: 'Trim wick to 5 mm. Burn up to 4 hours at a time.' },
  { id: 'pillow-mist', name: 'Lavender Dream Pillow Mist', category: 'Candles & Mists', price: 1250, sizes: ['100 ml'], img: 'facial2', gallery: ['facial2', 'wide', 'foot2'], rating: 4.6, reviews: 164,
    tagline: 'Sleep, scented.', desc: 'Lavender, chamomile and vetiver in a fine mist to settle the mind and prepare for deep rest.', notes: ['Lavender', 'Chamomile', 'Vetiver'], how: 'Spritz pillows and linen 10 minutes before sleep.' },
  { id: 'gift-ritual', name: 'The Velvet Ritual Gift Set', category: 'Gift Sets', price: 8900, sizes: ['Set of 5'], img: 'reception', gallery: ['reception', 'facial', 'wide'], badge: 'Gift favourite', rating: 5.0, reviews: 98,
    tagline: 'Five bestsellers in a keepsake box.', desc: 'Rose serum, gold cream, body oil, hand butter and a travel candle, presented in a velvet-lined box.', notes: ['Serum', 'Cream', 'Body oil', 'Hand butter', 'Candle'], how: 'Includes a handwritten card and complimentary gift wrapping.' },
]
export const pimg = (k: string) => `/img/${k}.jpg`
export const byId = (id: string) => products.find((p) => p.id === id)

export const rituals: { title: string; sub: string; img: string; ids: string[] }[] = [
  { title: 'Morning Glow', sub: 'Wake the skin', img: 'facial', ids: ['cleansing-balm', 'rose-serum', 'hand-cream'] },
  { title: 'Evening Unwind', sub: 'Slow the senses', img: 'wide', ids: ['clay-mask', 'gold-cream', 'pillow-mist'] },
  { title: 'Body Ritual', sub: 'Spa at home', img: 'back', ids: ['salt-scrub', 'body-oil', 'candle'] },
  { title: 'Hair Care', sub: 'Strength & shine', img: 'reception', ids: ['scalp-ritual', 'hair-elixir'] },
]
export const voices: [string, string, string][] = [
  ['The rose serum is the only product my skin has ever fully agreed with. I get compliments weekly.', 'Divya M.', 'Velvet Rose Glow Serum'],
  ['Smells exactly like the spa lobby. The candle makes my whole flat feel expensive.', 'Karthik R.', 'Velvet Hour Soy Candle'],
  ['Packaging, texture, fragrance: everything feels considered. The gift set was a hit.', 'Anjali P.', 'Velvet Ritual Gift Set'],
]
