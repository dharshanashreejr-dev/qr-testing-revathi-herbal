import type { ArtType, CategoryKey, Colour, Product } from '../types';
import { stockOverride, getThreshold, adjustStock } from '../../api/stock';

export const CATEGORIES: { name: CategoryKey; blurb: string; subs: string[] }[] = [
  {
    name: 'face',
    blurb: 'A complete face edit, from everyday cleansing and SPF to treatment serums, eye care and lip colour.',
    subs: ['Cleansers', 'Toners & Essences', 'Serums', 'Moisturisers', 'Sunscreen', 'Exfoliators', 'Masks', 'Eye Care', 'Lip Care', 'Lipstick', 'Lip Gloss', 'Makeup', 'Mascara', 'Acne Care'],
  },
  {
    name: 'wellness products',
    blurb: 'Wellness rituals for slower mornings, deeper rest and everyday balance—without the old beauty-tool collection.',
    subs: ['Aromatherapy', 'Bath Rituals', 'Candles', 'Sleep & Relaxation', 'Body Recovery', 'Hydration', 'Mindfulness', 'Supplements'],
  },
  {
    name: 'body',
    blurb: 'Complete body care from shower and exfoliation to moisturising, hand and foot care, deodorants and bath.',
    subs: ['Body Wash', 'Lotions & Creams', 'Body Oils', 'Scrubs', 'Bath & Soaks', 'Hand & Foot Care', 'Deodorants', 'Body Mists', 'Self Tan', 'Hair Care'],
  },
];

const c = (name: string, hex: string): Colour => ({ name, hex });
const AMBER = c('Amber', '#B8924F'), SAGE = c('Sage', '#9CAF88'), BLUSH = c('Blush', '#e0aa98');
const CLAY = c('Clay', '#a9714f'), STONE = c('Stone', '#A9A39B'), INK = c('Onyx', '#3A2A2E');
const ROSE = c('Rose', '#e8b4b8'), JADE = c('Jade', '#4FB287'), OAT = c('Oat', '#E8D3A9');
const SAND = c('Sand', '#E8D3A9'), COCOA = c('Cocoa', '#6d4a3a'), SKY = c('Mist', '#a9bfcb');
const PLUM = c('Plum', '#8a5a6e'), NUDE = c('Nude', '#c68f79'), BERRY = c('Berry', '#7c304d');
const RED = c('Rouge', '#a52c3b'), PEACH = c('Peach', '#e8a486'), CLEAR = c('Clear', '#DCE8EE');

interface Seed {
  n: string; sub: string; art: ArtType; price: number; mrp: number; stock: number;
  colours: Colour[]; sizes: string[]; rating: number; reviews: number; badge?: string;
  description: string; details: string[]; material: string; weight: string;
}
const s = (sub: string, art: ArtType, n: string, price: number, mrp: number, stock: number, colours: Colour[], sizes: string[], rating: number, reviews: number, badge: string | undefined, description: string, details: string[], material: string, weight: string): Seed =>
  ({ n, sub, art, price, mrp, stock, colours, sizes, rating, reviews, badge, description, details, material, weight });

import { getPatch, getAdded, saveAdded, setPatch, type Added } from '../../api/catalogue';

// Admin edits (price, discount, photo, archive) are layered on top of the seed through getters, so the shop is always live.
const mk = (category: CategoryKey, id: string, sku: string, x: Seed): Product => ({
  id, sku, category, subcategory: x.sub,
  get name() { return getPatch(id).name ?? x.n; },
  get art() { return (getPatch(id).image ?? x.art) as ArtType; },
  get price() { return getPatch(id).price ?? x.price; },
  get mrp() { return getPatch(id).mrp ?? x.mrp; },
  get description() { return getPatch(id).description ?? x.description; },
  get archived() { return !!getPatch(id).archived; },
  get status() { const st = getPatch(id).status; return st === 'Draft' ? 'Active' : (st ?? 'Active'); }, // Draft no longer exists: availability follows stock
  get discountType() { return getPatch(id).discountType ?? 'percent'; },
  get discountValue() { const q = getPatch(id); return q.discountValue ?? Math.round(((this.mrp - this.price) / this.mrp) * 100); },
  // LIVE stock: read every time, so an order or a staff update shows on the shop straight away.
  // Admin can mark a product Out of stock by hand (Admin > Products > Availability); the real quantity is kept for when it is switched back.
  get forcedOut() { return getPatch(id).availability === 'out'; },
  get stock() { return getPatch(id).availability === 'out' ? 0 : (stockOverride(id) ?? x.stock); },
  baseStock: x.stock, colours: x.colours, sizes: x.sizes, rating: x.rating, reviews: x.reviews,
  badge: x.badge, details: x.details, material: x.material, weight: x.weight,
});
// Lipstick shade families: one card per family, each card carries its 4 serial-numbered shades (photo + hex change live).
const sh = (code: string, nm: string, hex: string): Colour => ({ name: `${code} · ${nm}`, hex, code, photo: `/assets/products/lipstick/${code.toLowerCase()}.webp` });
const LIP_RED = [sh('R1', 'Classic Red', '#B22222'), sh('R2', 'Cherry Red', '#DC143C'), sh('R3', 'Wine Red', '#722F37'), sh('R4', 'Brick Red', '#A0522D')];
const LIP_NUDE = [sh('N1', 'Light Nude', '#E8D3A9'), sh('N2', 'Peach Nude', '#F4A460'), sh('N3', 'Caramel Nude', '#B8924F'), sh('N4', 'Mocha Nude', '#8B5E3C')];
const LIP_GREEN = [sh('G1', 'Mint Green', '#98D8B5'), sh('G2', 'Olive Green', '#6B7B2E'), sh('G3', 'Forest Green', '#2E6B3F'), sh('G4', 'Khaki Green', '#B8924F')];
const LIP_PINK = [sh('P1', 'Baby Pink', '#F2C6C2'), sh('P2', 'Rose Pink', '#FF6F91'), sh('P3', 'Fuchsia Pink', '#E75480'), sh('P4', 'Mauve Pink', '#B56576')];
// Serum + Compact Powder flavours: each flavour has its own photo (same pattern as the lipstick shades).
const fl = (name: string, hex: string, dir: string, file: string): Colour => ({ name, hex, photo: `/assets/products/${dir}/${file}.webp` });
const SERUM_FL = [fl('Lavender', '#C98A9B', 'serum', 'lavender'), fl('Rose', '#F3B9C0', 'serum', 'rose'), fl('Matcha', '#9DBF7B', 'serum', 'matcha'), fl('Citrus', '#B8924F', 'serum', 'citrus')];
const POWDER_FL = [fl('Lavender', '#C98A9B', 'compact', 'lavender'), fl('Rose', '#F2C4C9', 'compact', 'rose'), fl('Matcha', '#9DBF7B', 'compact', 'matcha'), fl('Citrus', '#EDB48F', 'compact', 'citrus')];
const MOIST_FL = [fl('Lavender', '#C98A9B', 'moisturiser', 'lavender'), fl('Rose', '#F4C6CB', 'moisturiser', 'rose'), fl('Matcha', '#9DBF7B', 'moisturiser', 'matcha'), fl('Citrus', '#E8D3A9', 'moisturiser', 'citrus')];
const CLEANSER_FL = [fl('Lavender', '#C98A9B', 'cleanser', 'lavender'), fl('Rose', '#F2C0C8', 'cleanser', 'rose'), fl('Matcha', '#9DBF7B', 'cleanser', 'matcha'), fl('Citrus', '#B8924F', 'cleanser', 'citrus')];
const GEL_FL = [fl('Lavender', '#C98A9B', 'pimple-gel', 'lavender'), fl('Rose', '#F4C9D0', 'pimple-gel', 'rose'), fl('Matcha', '#9DBF7B', 'pimple-gel', 'matcha'), fl('Citrus', '#F6B58E', 'pimple-gel', 'citrus')];
const SHOWER_FL = [fl('Lavender', '#C98A9B', 'shower-gel', 'lavender'), fl('Rose', '#F2C6C2', 'shower-gel', 'rose'), fl('Matcha', '#9DBF7B', 'shower-gel', 'matcha'), fl('Citrus', '#B8924F', 'shower-gel', 'citrus')];
// Mascara + Eucalyptus Oil families: each shade / blend has its own product photo (same pattern as the serum flavours).
const ph = (name: string, hex: string, dir: string, file: string): Colour => ({ name, hex, photo: `/assets/products/${dir}/${file}.webp` });
const SOAK_FL = [ph('Sandalwood & Saffron', '#B8924F', 'bath-soak', 'sandalwood-saffron'), ph('Rose & Himalayan Salt', '#EBC9C4', 'bath-soak', 'rose-himalayan-salt'), ph('Eucalyptus & Mint', '#8FBFA8', 'bath-soak', 'eucalyptus-mint'), ph('Lavender & Coconut', '#F2C6C2', 'bath-soak', 'lavender-coconut')];
const MIST_FL = [ph('Eucalyptus & Mint', '#8FBFA8', 'body-mist', 'eucalyptus-mint'), ph('Rose & Cucumber', '#F4E8CF', 'body-mist', 'rose-cucumber'), ph('Sandalwood & Saffron', '#E8D3A9', 'body-mist', 'sandalwood-saffron'), ph('Lavender & Aloe', '#C6D5C2', 'body-mist', 'lavender-aloe')];
const GLOSS_FL = [ph('Peach Glow', '#E8A58E', 'lipgloss', 'peach-glow'), ph('Honey Shine', '#B8924F', 'lipgloss', 'honey-shine'), ph('Rose Nude', '#D99A9C', 'lipgloss', 'rose-nude'), ph('Berry Blush', '#C4506A', 'lipgloss', 'berry-blush')];
const MASCARA_FL = [ph('Volume Black', '#3A2A2E', 'mascara', 'volume-black'), ph('Waterproof Brown', '#6B4A36', 'mascara', 'waterproof-brown'), ph('Green Tea', '#A9C48A', 'mascara', 'green-tea'), ph('Curling Rose', '#E8B4B8', 'mascara', 'curling-rose')];
const EUC_OIL_FL = [ph('Lavender', '#C98A9B', 'eucalyptus-oil', 'lavender'), ph('Mint', '#9FD8B8', 'eucalyptus-oil', 'mint'), ph('Lemongrass', '#C8D25F', 'eucalyptus-oil', 'lemongrass'), ph('Rosemary', '#6F8F5B', 'eucalyptus-oil', 'rosemary')];
const BCREAM1 = ph('Variety 1 · Eucalyptus & Menthol', '#4f8a4a', 'body-cream', 'eucalyptus-menthol'), BCREAM2 = ph('Variety 2 · Turmeric & Sandalwood', '#B8924F', 'body-cream', 'turmeric-sandalwood');
const lipSeed = (fam: string, cols: Colour[], blurb: string, badge?: string) =>
  s('Lipstick', 'lipstick', `Revathi ${fam} Lipstick`, 1599, 1899, 60, cols, ['3.5 g'], 4.8, 210, badge, blurb, ['4 serial-numbered shades', 'Vitamin E', 'One-swipe colour'], 'Metallic lipstick case', '38 g');
const build = (category: CategoryKey, code: string, seeds: Seed[]): Product[] =>
  seeds.map((x, i) => mk(category, `LUM-${code}-${String(i + 1).padStart(3, '0')}`, `${code}${x.art.slice(0, 2).toUpperCase()}${1000 + i * 37}`, x));

const face = build('face', 'FC', [
  s('Cleansers', 'pump', 'Brume Amino Gel Cleanser', 1399, 1699, 120, [SKY, OAT, SAGE], ['100 ml', '200 ml'], 4.7, 701, 'Bestseller', 'A low-foam amino-acid cleanser that removes sunscreen and daily makeup without stripping.', ['pH balanced', 'Fragrance free', 'Suitable for daily use'], 'Recyclable bottle with pump', '220 g'),
  s('Cleansers', 'bottle', 'Perle Cleansing Milk', 1599, 1899, 68, [OAT, CLEAR], ['150 ml', '250 ml'], 4.6, 311, undefined, 'A milky cleanser that dissolves complexion products while leaving skin soft.', ['Glycerin rich', 'No drying alcohol', 'Morning and evening'], 'Glass bottle', '280 g'),
  s('Toners & Essences', 'bottle', 'Rosée Balancing Essence', 1899, 2299, 55, [ROSE, SKY], ['120 ml', '200 ml'], 4.6, 245, 'New', 'A watery essence with niacinamide and rice extract for fresh, balanced-looking skin.', ['Alcohol free', 'Layerable hydration', 'Lightweight texture'], 'Glass bottle', '250 g'),
  s('Toners & Essences', 'pump', 'Nacre Pore Refining Toner', 1799, 2199, 37, [SAGE, CLEAR], ['150 ml'], 4.5, 198, undefined, 'A gentle daily toner with PHA and green tea for smoother-looking pores.', ['Low-acid formula', 'Green tea extract', 'Use after cleansing'], 'Frosted pump bottle', '240 g'),
  s('Serums', 'dropper', 'Aurelia Hyaluronic Dew Serum', 2499, 2999, 42, [AMBER, SAGE, BLUSH], ['15 ml', '30 ml'], 4.8, 412, 'Bestseller', 'A multi-molecular hyaluronic serum that gives skin a plump, dewy finish.', ['Three molecular weights', 'Absorbs quickly', 'Fragrance free'], 'Glass dropper bottle', '95 g'),
  s('Serums', 'dropper', 'Solène Vitamin C Radiance Serum', 2899, 3499, 18, [AMBER, CLAY], ['15 ml', '30 ml'], 4.6, 268, 'New', 'A brightening vitamin C serum designed to improve the look of dull, uneven tone.', ['10% vitamin C', 'Ferulic acid', 'Morning use under SPF'], 'UV-safe amber glass', '88 g'),
  s('Serums', 'dropper', 'Opaline Retinal Renewal Serum', 3299, 3999, 21, [PLUM, STONE], ['15 ml'], 4.7, 133, undefined, 'An encapsulated retinal treatment for the look of fine lines and uneven texture.', ['0.05% retinal', 'Evening use', 'Squalane based'], 'Frosted glass dropper', '82 g'),
  s('Moisturisers', 'jar', 'Velours Ceramide Barrier Cream', 2199, 2599, 65, [OAT, SAGE, BLUSH], ['50 ml', '100 ml'], 4.7, 530, 'Bestseller', 'A rich ceramide cream that cushions dry, stressed skin with a satin finish.', ['Three essential ceramides', 'Oat extract', 'Non-comedogenic'], 'Glass jar', '210 g'),
  s('Moisturisers', 'pump', 'Soie Silk Cloud Gel Cream', 1899, 2299, 58, [OAT, SKY], ['50 ml', '75 ml'], 4.5, 301, undefined, 'An airy gel cream for lightweight hydration under makeup.', ['Oil free', 'Vegan', 'Fast absorbing'], 'Airless pump bottle', '120 g'),
  s('Sunscreen', 'pump', 'Éclat Daily Shield SPF 50', 1699, 1999, 84, [OAT, CLEAR], ['40 ml', '75 ml'], 4.7, 624, 'Bestseller', 'A broad-spectrum daily sunscreen with a soft, invisible finish.', ['SPF 50 PA++++', 'No white cast', 'Makeup friendly'], 'Airless tube pump', '95 g'),
  s('Sunscreen', 'tube', 'REVATHI HERBAL Mineral Veil SPF 40', 1899, 2299, 33, [CLEAR, SAND], ['50 ml'], 4.5, 184, undefined, 'A mineral sunscreen with a sheer skin-smoothing finish.', ['Zinc oxide', 'Sensitive-skin friendly', 'Fragrance free'], 'Recyclable squeeze tube', '78 g'),
  s('Exfoliators', 'tube', 'Velvet PHA Resurfacing Gel', 1999, 2399, 29, [CLEAR, PEACH], ['75 ml'], 4.6, 163, undefined, 'A gentle PHA gel that refines the appearance of rough texture.', ['PHA complex', 'Use 2–3 nights weekly', 'Rinse-off treatment'], 'Recyclable tube', '105 g'),
  s('Exfoliators', 'jar', 'Café Enzyme Polish', 1799, 2149, 46, [COCOA, OAT], ['60 g', '120 g'], 4.4, 143, undefined, 'A powder-to-cream enzyme polish for a smooth, fresh-looking complexion.', ['Papaya enzyme', 'Fine rice powder', 'Mix with water'], 'Glass jar', '155 g'),
  s('Masks', 'jar', 'Argile Rose Clay Mask', 1999, 2399, 27, [CLAY, SAGE, ROSE], ['75 ml', '150 ml'], 4.4, 156, undefined, 'A creamy clay mask that helps absorb excess oil without a tight after-feel.', ['Kaolin and bentonite', 'Aloe vera', 'Weekly treatment'], 'Glass jar', '240 g'),
  s('Masks', 'jar', 'Mirage Overnight Sleeping Mask', 2599, 3099, 33, [BLUSH, SKY], ['60 ml'], 4.6, 118, 'New', 'A cushiony overnight mask for visibly plumper, rested-looking skin.', ['Bakuchiol', 'Hyaluronic acid', 'Leave on overnight'], 'Glass jar', '170 g'),
  s('Eye Care', 'pump', 'Éclat Caffeine Eye Serum', 2199, 2699, 36, [OAT, SKY], ['15 ml'], 4.5, 207, undefined, 'A cooling caffeine eye serum that refreshes the look of tired eyes.', ['Caffeine and niacinamide', 'Cooling metal tip', 'Ophthalmologist tested'], 'Airless eye pump', '45 g'),
  s('Eye Care', 'jar', 'Nuit Peptide Eye Cream', 2399, 2899, 24, [OAT, BLUSH], ['15 ml'], 4.7, 151, 'New', 'A silky peptide eye cream for the look of fine lines and dryness.', ['Five-peptide complex', 'Ceramides', 'Rich but non-greasy'], 'Mini glass jar', '55 g'),
  s('Lip Care', 'stick', 'Baiser Peptide Lip Balm', 999, 1199, 76, [CLEAR, BLUSH, NUDE], ['4 g'], 4.7, 344, 'Bestseller', 'A nourishing lip balm with a soft sheen for everyday comfort.', ['Shea and jojoba butter', 'Clear finish', 'Easy glide'], 'Aluminium lipstick tube', '28 g'),
  lipSeed('Red', LIP_RED, 'Four bold reds from classic to brick, each with its own serial number. Pick a shade to see it on the lips.', 'Bestseller'),
  s('Makeup', 'compact', 'REVATHI HERBAL Skin Tint SPF 30', 2499, 2999, 39, [NUDE, PEACH, SAND, COCOA], ['30 ml'], 4.6, 318, 'New', 'A breathable skin tint with soft coverage and a radiant satin finish.', ['12 flexible shades', 'SPF 30', 'Buildable coverage'], 'Glass bottle with pump', '145 g'),
  s('Makeup', 'palette', 'Atelier Nude Eyeshadow Palette', 2899, 3499, 42, [NUDE, COCOA, PLUM], ['12 shades'], 4.8, 402, 'Bestseller', 'A curated twelve-pan palette of wearable matte and shimmer neutrals.', ['12 shades', 'Blendable powders', 'Mirror included'], 'Magnetic compact palette', '210 g'),
  s('Makeup', 'compact', 'Velours Soft-Matte Blush', 1599, 1899, 47, [PEACH, ROSE, BERRY], ['6 g'], 4.7, 276, undefined, 'A finely milled blush that builds from a whisper of colour to a full flush.', ['Buildable pigment', 'Soft-matte finish', 'Mirror compact'], 'Pressed powder compact', '55 g'),
  s('Acne Care', 'tube', 'Clarté Blemish Spot Gel', 1299, 1599, 62, [CLEAR, SKY], ['15 ml'], 4.5, 188, undefined, 'A targeted gel with salicylic acid for the appearance of active blemishes.', ['2% salicylic acid', 'Fast-drying gel', 'Use as directed'], 'Precision nozzle tube', '28 g'),
  s('Primer', 'pump', 'Velours Blur Makeup Primer', 1899, 2299, 44, [CLEAR, OAT], ['30 ml'], 4.6, 209, undefined, 'A silky primer that smooths the look of texture and helps makeup sit evenly.', ['Soft-focus finish', 'Silicone-light texture', 'Works under foundation'], 'Airless pump bottle', '125 g'),
  s('Foundation', 'pump', 'REVATHI HERBAL Silk Foundation', 2499, 2999, 36, [NUDE, PEACH, SAND, COCOA], ['30 ml'], 4.7, 318, 'Bestseller', 'A medium-buildable foundation with a satin finish and flexible coverage.', ['18 shades', 'Buildable coverage', 'Long-wear comfort'], 'Glass pump bottle', '145 g'),
  s('Concealer', 'stick', 'Éclat Cream Concealer', 1699, 1999, 48, [NUDE, PEACH, COCOA], ['6 ml'], 4.6, 244, undefined, 'A creamy concealer for under-eyes and targeted complexion coverage.', ['16 shades', 'Crease-resistant', 'Satin finish'], 'Twist-up applicator', '42 g'),
  s('Blush', 'compact', 'Rose Veil Powder Blush', 1599, 1899, 47, [PEACH, ROSE, BERRY], ['6 g'], 4.7, 276, undefined, 'A finely milled blush that builds from a soft veil to a fresh flush.', ['Buildable pigment', 'Soft satin finish', 'Mirror compact'], 'Pressed powder compact', '55 g'),
  s('Bronzer', 'compact', 'Soleil Sculpt Bronzer', 1799, 2199, 39, [SAND, COCOA, NUDE], ['8 g'], 4.6, 198, undefined, 'A softly matte bronzer for warm and gentle definition.', ['Buildable colour', 'Fine powder', 'Large mirror pan'], 'Pressed powder compact', '64 g'),
  s('Highlighter', 'compact', 'Nacre Glow Highlighter', 1699, 1999, 52, [SAND, PEACH, ROSE], ['7 g'], 4.8, 231, 'New', 'A finely milled highlighter that catches light without chunky glitter.', ['Silky shimmer', 'Buildable glow', 'Mirror compact'], 'Pressed powder compact', '60 g'),
  s('Mascara', 'tube', 'Noir Lift Mascara', 1499, 1799, 73, [INK], ['10 ml'], 4.5, 412, 'Bestseller', 'A buildable mascara that lifts and defines lashes without a heavy finish.', ['Smudge resistant', 'Tapered brush', 'Buildable volume'], 'Mascara tube', '42 g'),
  s('Eyeliner', 'stick', 'Graphite Precision Liner', 999, 1199, 81, [INK, COCOA, PLUM], ['1 g'], 4.6, 388, undefined, 'A smooth eye pencil for precise lines and softly smoked looks.', ['Creamy glide', 'Sharpenable tip', 'Transfer resistant'], 'Wood pencil with cap', '8 g'),
  lipSeed('Pink', LIP_PINK, 'Four pinks from baby to mauve, each with its own serial number. Pick a shade to see it on the lips.', 'New'),
  s('Lip Gloss', 'gloss', 'Miroir Glass Lip Gloss', 1299, 1599, 71, [CLEAR, PEACH, ROSE, BERRY], ['5.5 ml'], 4.7, 341, undefined, 'A high-shine gloss that smooths the look of lips without sticky drag.', ['Glass-like shine', 'Cushion applicator', 'Layer over lipstick'], 'Gloss tube', '36 g'),
  s('Setting Spray', 'spray', 'Brume Makeup Setting Mist', 1599, 1899, 54, [CLEAR, SKY], ['100 ml'], 4.6, 217, undefined, 'A fine setting mist that helps complexion makeup look fresh throughout the day.', ['Fine continuous mist', 'Hydrating finish', 'Travel friendly'], 'Glass spray bottle', '170 g'),
]);

// Nude + Green cards get fresh ids after the existing face products, so no other product's id/stock/reviews change.
{
  const next = face.length;
  const mkLip = (i: number, seed: Seed) => mk('face', `LUM-FC-${String(next + i + 1).padStart(3, '0')}`, `FCLI${1000 + (next + i) * 37}`, seed);
  const nude = mkLip(0, lipSeed('Nude', LIP_NUDE, 'Four everyday nudes from light to mocha, each with its own serial number. Pick a shade to see it on the lips.'));
  const green = mkLip(1, lipSeed('Green', LIP_GREEN, 'Four statement greens from mint to khaki, each with its own serial number. Pick a shade to see it on the lips.', 'New'));
  const isLip = (x: Product) => x.subcategory === 'Lipstick';
  const red = face.find(x => x.name.includes('Red Lipstick'))!, pink = face.find(x => x.name.includes('Pink Lipstick'))!;
  const rest = face.filter(x => !isLip(x));
  face.splice(0, face.length, red, nude, green, pink, ...rest); // lipstick cards go first on the Face page
}

// Serum + Compact Powder cards (4 flavours each). The older serum, cleanser, moisturiser and spot-gel cards are taken off the shop;
// new cards get fresh ids, so no other product's id / stock / reviews change.
{
  const n0 = face.length;
  const mkFam = (i: number, seed: Seed) => mk('face', `LUM-FC-${String(n0 + i + 1).padStart(3, '0')}`, `FCFL${1000 + (n0 + i) * 37}`, seed);
  const serum = mkFam(0, s('Serums', 'dropper', 'Revathi Herbal Serum', 2299, 2699, 60, SERUM_FL, ['30 ml'], 4.8, 96, 'New', 'Four botanical serums, from calming lavender to bright citrus. Pick a flavour to see its bottle.', ['4 flavours', 'Lightweight, fast-absorbing', '30 ml glass dropper bottle'], 'Glass dropper bottle', '95 g'));
  const powder = mkFam(1, s('Makeup', 'compact', 'Revathi Herbal Compact Powder', 1499, 1799, 60, POWDER_FL, ['10 g'], 4.7, 84, 'New', 'A silky pressed compact powder in four botanical flavours. Pick a flavour to see it.', ['4 flavours', 'Silky pressed finish', 'Mirror compact'], 'Gold-tone mirror compact', '45 g'));
  const cleanser = mkFam(2, s('Cleansers', 'pump', 'Revathi Herbal Foaming Cleanser', 1299, 1599, 60, CLEANSER_FL, ['150 ml'], 4.7, 92, 'New', 'Four botanical foaming cleansers, from soothing lavender to bright citrus. Pick a flavour to see its bottle.', ['4 flavours', 'Gentle foaming wash', 'Pump bottle'], 'Pump bottle', '210 g'));
  const moist = mkFam(3, s('Moisturisers', 'jar', 'Revathi Herbal Moisturiser', 1999, 2399, 60, MOIST_FL, ['50 ml'], 4.7, 88, 'New', 'Four botanical moisturisers, from soothing lavender to bright citrus. Pick a flavour to see its jar.', ['4 flavours', 'Hydrating, non-greasy', '50 ml glass jar'], 'Glass jar with gold-tone lid', '160 g'));
  const pimple = mkFam(4, s('Acne Care', 'tube', 'Revathi Herbal Pimple Gel', 1299, 1599, 60, GEL_FL, ['15 ml'], 4.6, 74, 'New', 'Four botanical spot-treatment gels, from calming lavender to bright citrus. Pick a flavour to see its tube.', ['4 flavours', 'Spot-treatment gel', 'Squeeze tube'], 'Squeeze tube', '28 g'));
  const keep = face.filter(x => !['Serums', 'Cleansers', 'Moisturisers', 'Acne Care'].includes(x.subcategory));
  face.splice(0, face.length, ...keep.slice(0, 4), serum, powder, cleanser, moist, pimple, ...keep.slice(4)); // after the 4 lipstick cards
}

// Mascara card (4 shades). The older single Noir Lift Mascara is taken off the shop; the new card gets a fresh id, so no other product changes.
{
  const nextId = face.reduce((m, x) => Math.max(m, Number(x.id.split('-').pop()) || 0), 0) + 1;
  const mascara = mk('face', `LUM-FC-${String(nextId).padStart(3, '0')}`, `FCMA${1000 + nextId * 37}`, s('Mascara', 'tube', 'Revathi Herbal Mascara', 1499, 1799, 60, MASCARA_FL, ['10 ml'], 4.7, 88, 'New', 'Four signature mascaras: Volume Black, Waterproof Brown, Green Tea Lengthening and Curling Rose. Pick a shade to see its tube.', ['4 mascara formulas', 'Smudge resistant', '10 ml tube'], 'Mascara tube with gold-tone cap', '42 g'));
  const at = face.findIndex(x => x.subcategory === 'Mascara');
  const rest = face.filter(x => x.subcategory !== 'Mascara');
  rest.splice(at < 0 ? rest.length : at, 0, mascara);
  face.splice(0, face.length, ...rest);
}

// Lip Gloss card (4 shades) joins the Face page next to the existing gloss; fresh id, nothing else changes.
{
  const nextId = face.reduce((m, x) => Math.max(m, Number(x.id.split('-').pop()) || 0), 0) + 1;
  const gloss = mk('face', `LUM-FC-${String(nextId).padStart(3, '0')}`, `FCLG${1000 + nextId * 37}`, s('Lip Gloss', 'gloss', 'Revathi Herbal Lipgloss', 899, 1099, 60, GLOSS_FL, ['5 ml'], 4.7, 72, 'New', 'Four lipgloss shades: Peach Glow, Honey Shine, Rose Nude and Berry Blush. Pick a shade to see its tube.', ['4 shades', 'Glossy, comfortable finish', '5 ml tube'], 'Clear tube with gold-tone cap', '30 g'));
  const at = face.findIndex(x => x.subcategory === 'Lip Gloss');
  face.splice(at < 0 ? face.length : at, 0, gloss);
}

const wellness = build('wellness products', 'WL', [
  s('Aromatherapy', 'bottle', 'Calme Lavender Essential Oil', 1299, 1599, 74, [PLUM, CLEAR], ['10 ml'], 4.7, 302, 'Bestseller', 'A pure lavender aromatic oil for diffuser and evening rituals.', ['100% lavender oil', 'Amber glass', 'Dropper included'], 'Amber glass bottle', '48 g'),
  s('Aromatherapy', 'bottle', 'Équilibre Eucalyptus Essential Oil', 1199, 1499, 58, [SAGE, CLEAR], ['10 ml'], 4.6, 217, undefined, 'A crisp eucalyptus aroma for refreshing diffuser rituals.', ['Pure essential oil', 'Use diluted where appropriate', 'Amber glass'], 'Amber glass bottle', '48 g'),
  s('Aromatherapy', 'spray', 'Brume Pillow & Linen Mist', 1499, 1799, 65, [SKY, OAT], ['100 ml'], 4.6, 341, 'New', 'A soft lavender and chamomile mist for pillows, linen and evening wind-downs.', ['Fine mist', 'Alcohol-light formula', 'Travel friendly'], 'Glass spray bottle', '180 g'),
  s('Bath Rituals', 'bottle', 'Sel de Mer Mineral Bath Salts', 1699, 1999, 48, [SKY, SAGE], ['300 g', '600 g'], 4.7, 190, undefined, 'A mineral salt blend with lavender for a restorative bath ritual.', ['Epsom and sea salts', 'Lavender aroma', 'Resealable bottle'], 'Glass apothecary jar', '700 g'),
  s('Bath Rituals', 'jar', 'Rose Milk Bath Soak', 1799, 2149, 36, [ROSE, OAT], ['250 g'], 4.6, 154, undefined, 'A creamy bath powder with oat and rose for a soft, comforting soak.', ['Colloidal oat', 'Rose petals', 'Single-use scoop'], 'Glass jar', '310 g'),
  s('Candles', 'candle', 'Santal No. 07 Soy Candle', 2299, 2799, 41, [COCOA, AMBER], ['180 g', '300 g'], 4.8, 426, 'Bestseller', 'A warm sandalwood and amber candle poured for slow evenings.', ['Soy wax', 'Cotton wick', 'Approx. 40 hour burn'], 'Frosted glass vessel', '520 g'),
  s('Candles', 'candle', 'Rose Atelier Candle', 2199, 2599, 32, [ROSE, BLUSH], ['180 g'], 4.7, 201, undefined, 'A fresh rose and soft musk candle with an elegant floral dry-down.', ['Soy wax', 'Cotton wick', 'Approx. 40 hour burn'], 'Glass vessel', '500 g'),
  s('Candles', 'candle', 'Cèdre Rain Candle', 2399, 2899, 19, [SAGE, COCOA], ['220 g'], 4.6, 138, 'New', 'Cedar, rain and green leaves create a clean, atmospheric home scent.', ['Coconut-soy wax', 'Woodland fragrance', 'Approx. 45 hour burn'], 'Amber glass vessel', '570 g'),
  s('Sleep & Relaxation', 'box', 'Dream Tea Night Blend', 899, 1099, 84, [OAT, SAGE], ['20 sachets'], 4.5, 244, undefined, 'A caffeine-free chamomile, lemon balm and lavender herbal tea.', ['Caffeine free', 'Individually wrapped sachets', 'Evening ritual'], 'Paper tea box', '62 g'),
  s('Sleep & Relaxation', 'bottle', 'Nocturne Magnesium Bath Flakes', 1599, 1899, 44, [CLEAR, SKY], ['500 g'], 4.6, 179, undefined, 'Magnesium chloride flakes for a relaxing end-of-day bath.', ['Dissolves quickly', 'Fragrance free', 'Resealable pack'], 'Recyclable bottle', '560 g'),
  s('Body Recovery', 'tube', 'Recovery Body Cream', 1899, 2299, 29, [BCREAM1, BCREAM2], ['100 g'], 4.5, 127, undefined, 'A herbal recovery body cream in two varieties: eucalyptus and menthol for cooling muscle relief, or turmeric and sandalwood for joint and pain relief.', ['Eucalyptus & menthol or turmeric & sandalwood', 'Herbal formula', 'Fast-absorbing'], 'Tube', '100 g'),
  s('Body Recovery', 'bottle', 'Warm Ginger Massage Oil', 2199, 2599, 38, [AMBER, COCOA], ['150 ml', '250 ml'], 4.8, 219, 'Bestseller', 'A smooth grapeseed and ginger massage oil designed for slow recovery rituals.', ['Excellent slip', 'Ginger aroma', 'Easy-pour bottle'], 'Glass bottle', '280 g'),
  s('Hydration', 'bottle', 'REVATHI HERBAL Glass Water Bottle', 1699, 1999, 57, [SKY, SAGE, BLUSH], ['500 ml', '750 ml'], 4.6, 312, undefined, 'A reusable glass bottle with a protective silicone sleeve.', ['BPA free', 'Leak-resistant cap', 'Dishwasher-safe bottle'], 'Borosilicate glass and silicone', '390 g'),
  s('Hydration', 'box', 'Hydra Electrolyte Sachets', 999, 1299, 91, [SKY, PEACH], ['10 sachets', '30 sachets'], 4.5, 205, 'New', 'A light citrus electrolyte mix for everyday hydration.', ['Low sugar', 'Single-serve sachets', 'Citrus flavour'], 'Paper carton', '125 g'),
  s('Mindfulness', 'box', 'Quiet Morning Journal', 1299, 1599, 33, [OAT, BLUSH, SAGE], ['A5'], 4.8, 189, 'Bestseller', 'A linen-bound guided journal with prompts for gratitude, priorities and reflection.', ['160 pages', 'Ribbon marker', 'Lay-flat binding'], 'Linen cover, recycled paper', '430 g'),
  s('Mindfulness', 'candle', 'Golden Hour Ritual Candle', 1999, 2399, 26, [AMBER, SAND], ['160 g'], 4.7, 117, undefined, 'A soft citrus, vanilla and sandalwood candle for a calm reset ritual.', ['Soy-coconut wax', 'Cotton wick', 'Approx. 35 hour burn'], 'Ceramic vessel', '460 g'),
]);

// Eucalyptus Oil card (4 blends) joins the Aromatherapy range at the front of the wellness page, with a fresh id.
{
  const nextId = wellness.reduce((m, x) => Math.max(m, Number(x.id.split('-').pop()) || 0), 0) + 1;
  const oil = mk('wellness products', `LUM-WL-${String(nextId).padStart(3, '0')}`, `WLAR${1000 + nextId * 37}`, s('Aromatherapy', 'bottle', 'Revathi Herbal Eucalyptus Oil', 1499, 1799, 60, EUC_OIL_FL, ['30 ml'], 4.7, 64, 'New', 'Four eucalyptus oil blends: Lavender, Mint, Lemongrass and Rosemary. Pick a blend to see its bottle.', ['4 eucalyptus blends', 'Dropper included', '30 ml amber glass bottle'], 'Amber glass dropper bottle', '75 g'));
  wellness.unshift(oil);
}

// Single wellness products from the new photo set (one photo each). Fresh ids, placed first in their sub-category.
{
  let id = wellness.reduce((m, x) => Math.max(m, Number(x.id.split('-').pop()) || 0), 0);
  const add = (code: string, sub: string, seed: Seed) => {
    id += 1;
    const p = mk('wellness products', `LUM-WL-${String(id).padStart(3, '0')}`, `${code}${1000 + id * 37}`, seed);
    const at = wellness.findIndex(y => y.subcategory === sub);
    wellness.splice(at < 0 ? wellness.length : at, 0, p);
  };
  add('WLSU', 'Supplements', s('Supplements', 'box', 'Glow Collagen Capsules', 1799, 2199, 60, [ph('Oat', '#E8D3A9', 'individual', 'glow-collagen-capsules')], ['30 capsules'], 4.6, 41, 'New', 'A daily beauty-support capsule in a 30 capsule bottle. Use as directed on the pack.', ['30 capsules', 'Daily use', 'Gold-tone cap bottle'], 'White bottle with gold-tone cap', '90 g'));
  add('WLTE', 'Sleep & Relaxation', s('Sleep & Relaxation', 'box', 'Calm & Sleep Wellness Tea', 799, 999, 60, [ph('Oat', '#E8D3A9', 'individual', 'calm-sleep-wellness-tea')], ['50 g'], 4.7, 63, 'New', 'A loose-leaf herbal blend of chamomile, lavender and lemon peel for calm evenings.', ['Caffeine free', 'Loose-leaf herbal blend', '50 g glass jar'], 'Glass jar with gold-tone lid', '160 g'));
  add('WLBD', 'Body Recovery', s('Body Recovery', 'dropper', 'Body Detox Wellness Oil', 1999, 2399, 60, [ph('Oat', '#E8D3A9', 'individual', 'body-detox-wellness-oil')], ['100 ml'], 4.7, 47, 'New', 'A botanical body wellness oil in a 100 ml amber glass dropper bottle.', ['Amber glass bottle', 'Dropper included', 'For body massage'], 'Amber glass dropper bottle', '210 g'));
  add('WLAR', 'Aromatherapy', s('Aromatherapy', 'bottle', 'Stress Relief Aroma Roller', 699, 899, 60, [ph('Mist', '#A9BFCB', 'individual', 'stress-relief-aroma-roller')], ['10 ml'], 4.6, 55, 'New', 'A pocket-size aroma roller for calming moments through the day.', ['10 ml glass roller', 'Easy to carry', 'Roll on pulse points'], 'Glass roller bottle', '45 g'));
}

const body = build('body', 'BD', [
  s('Body Wash', 'pump', 'Satin Cloud Body Wash', 1399, 1699, 104, [OAT, BLUSH, SAGE], ['250 ml', '500 ml'], 4.7, 512, 'Bestseller', 'A creamy body wash that leaves skin clean, soft and comfortable.', ['Glycerin rich', 'Sulfate free', 'Daily use'], 'Recyclable pump bottle', '310 g'),
  s('Body Wash', 'pump', 'Cèdre Green Tea Shower Gel', 1499, 1799, 72, [SAGE, CLEAR], ['250 ml', '500 ml'], 4.5, 228, undefined, 'A refreshing green tea and cedar shower gel with a clean lather.', ['pH balanced', 'Fresh botanical scent', 'Vegan'], 'Pump bottle', '320 g'),
  s('Lotions & Creams', 'pump', 'Shea Soie Body Lotion', 1399, 1699, 110, [ph('Oat', '#E8D3A9', 'individual', 'shea-soie-lotion')], ['250 ml', '500 ml'], 4.4, 633, undefined, 'An everyday shea and glycerin lotion that absorbs quickly without stickiness.', ['24-hour moisture', 'Dermatologically tested', 'Soft neutral scent'], 'Recyclable pump bottle', '300 g'),
  s('Lotions & Creams', 'jar', 'Nuage Whipped Body Butter', 1999, 2399, 60, [ph('Oat', '#E8D3A9', 'individual', 'nuage-body-butter')], ['150 ml', '300 ml'], 4.7, 512, 'Bestseller', 'A whipped shea body butter for deeply nourished, satin-soft skin.', ['Shea and mango butter', 'Vegan', 'Rich texture'], 'Glass jar', '380 g'),
  s('Lotions & Creams', 'tube', 'Lait de Coco Body Milk', 1599, 1899, 52, [OAT, SAND], ['250 ml'], 4.5, 203, undefined, 'A silky coconut body milk with a soft tropical scent.', ['Lightweight', 'Non-sticky', 'Vegan'], 'Recyclable tube', '280 g'),
  s('Body Oils', 'bottle', 'Satin Dry Body Oil', 2299, 2749, 47, [AMBER, SAND], ['100 ml', '200 ml'], 4.8, 390, 'Bestseller', 'A fast-absorbing jojoba and almond body oil for a luminous finish.', ['Never greasy', 'Use on damp skin', 'Warm cedar scent'], 'Glass bottle with pump', '260 g'),
  s('Body Oils', 'bottle', 'Chaleur Ginger Massage Oil', 2499, 2999, 15, [AMBER, COCOA], ['150 ml', '250 ml'], 4.9, 121, undefined, 'A warming grapeseed and ginger oil for long, slow body massages.', ['Excellent slip', 'Warm ginger scent', 'Easy-pour bottle'], 'Glass bottle', '280 g'),
  s('Scrubs', 'jar', 'Café Noir Body Scrub', 1699, 2049, 9, [COCOA, CLAY], ['200 g', '400 g'], 4.5, 276, 'Low stock', 'Fine coffee grounds and brown sugar buff away dullness for smoother-looking skin.', ['Use twice a week', 'Fresh coffee scent', 'Rinses clean'], 'Glass jar', '420 g'),
  s('Scrubs', 'jar', 'Sucre Vanilla Sugar Scrub', 1599, 1899, 41, [SAND, BLUSH], ['200 g', '400 g'], 4.6, 118, undefined, 'Raw cane sugar and vanilla oil polish skin to a creamy finish.', ['Moisturising oils', 'Gentle exfoliation', 'Vegan'], 'Glass jar', '410 g'),
  s('Bath & Soaks', 'jar', 'Sel de Mer Mineral Bath Soak', 1699, 1999, 38, [SKY, SAGE], ['300 g', '600 g'], 4.5, 142, undefined, 'Epsom and mineral salts with lavender for a restorative bath.', ['Dissolves in warm water', 'Lavender and eucalyptus', 'Resealable jar'], 'Glass jar', '700 g'),
  s('Bath & Soaks', 'bottle', 'Ambre Luxe Bath Oil', 2399, 2899, 17, [AMBER, PLUM], ['150 ml'], 4.8, 79, 'New', 'A decadent amber bath oil that leaves skin silky after a warm soak.', ['Sandalwood aroma', 'A little goes a long way', 'Glass bottle'], 'Glass bottle', '240 g'),
  s('Hand & Foot Care', 'tube', 'Mains Repair Hand Cream', 899, 1099, 86, [ph('Oat', '#E8D3A9', 'individual', 'mains-repair-hand-cream')], ['50 ml', '100 ml'], 4.7, 351, 'Bestseller', 'A rich but quick-absorbing hand cream for dry hands and cuticles.', ['Shea butter', 'Vitamin E', 'Non-greasy'], 'Aluminium-style tube', '72 g'),
  s('Hand & Foot Care', 'jar', 'Velours Heel Rescue Balm', 1099, 1299, 44, [OAT, COCOA], ['60 g'], 4.5, 149, undefined, 'A concentrated balm for rough heels and dry feet.', ['Urea and shea', 'Overnight treatment', 'Cotton-sock friendly'], 'Glass jar', '82 g'),
  s('Deodorants', 'stick', 'Pure Linen Deodorant Balm', 899, 1099, 63, [OAT, CLEAR], ['50 g'], 4.4, 207, undefined, 'A smooth everyday deodorant balm with a clean linen scent.', ['Aluminium free', 'Baking soda free', 'Easy glide'], 'Twist-up balm case', '68 g'),
  s('Deodorants', 'spray', 'Rose Neroli Body Deodorant Mist', 1099, 1299, 39, [ROSE, BLUSH], ['100 ml'], 4.5, 165, 'New', 'A light rose and neroli mist for a fresh, clean feel.', ['Alcohol light', 'Fine mist', 'Travel friendly'], 'Glass spray bottle', '165 g'),
  s('Body Mists', 'spray', 'Étoile Shimmer Body Mist', 1799, 2149, 24, [BLUSH, SAND, PLUM], ['100 ml'], 4.6, 187, undefined, 'A fine fragrance mist with a subtle golden shimmer.', ['Skin-safe shimmer', 'Vanilla amber scent', 'Layerable'], 'Glass spray bottle', '190 g'),
  s('Body Mists', 'spray', 'Rosée Rose Water Body Mist', 1499, 1799, 62, [ROSE, BLUSH], ['100 ml', '200 ml'], 4.5, 164, undefined, 'A fresh rose mist for an instant cooling veil of scent.', ['Alcohol free', 'Cooling feel', 'Travel friendly'], 'Glass spray bottle', '210 g'),
  s('Self Tan', 'pump', 'Soleil Gradual Tan Lotion', 1899, 2299, 31, [SAND, NUDE], ['150 ml'], 4.4, 93, 'New', 'A gradual tanning lotion that builds a golden glow.', ['Buildable colour', 'Hydrating base', 'No instant orange tone'], 'Airless pump bottle', '190 g'),
]);

// Shower Gel card (4 flavours). The older Body Wash cards are taken off the shop; the new card gets a fresh id.
{
  const n1 = body.length;
  const shower = mk('body', `LUM-BD-${String(n1 + 1).padStart(3, '0')}`, `BDFL${1000 + n1 * 37}`, s('Body Wash', 'pump', 'Revathi Herbal Shower Gel', 1499, 1799, 60, SHOWER_FL, ['500 ml'], 4.7, 96, 'New', 'Four botanical shower gels, from calming lavender to fresh citrus. Pick a flavour to see its bottle.', ['4 flavours', 'Gentle, rich lather', 'Pump bottle'], 'Pump bottle', '540 g'));
  body.splice(0, body.length, shower, ...body.filter(x => x.subcategory !== 'Body Wash'));
}

// Bath Soak + Body Mist cards (4 blends each). Existing bath and mist products stay; new cards get fresh ids and sit first in their sub-category.
{
  const nextId = body.reduce((m, x) => Math.max(m, Number(x.id.split('-').pop()) || 0), 0) + 1;
  const soak = mk('body', `LUM-BD-${String(nextId).padStart(3, '0')}`, `BDBS${1000 + nextId * 37}`, s('Bath & Soaks', 'jar', 'Revathi Herbal Bath Soak', 1299, 1599, 60, SOAK_FL, ['250 g'], 4.7, 58, 'New', 'Four botanical bath soaks: Sandalwood & Saffron, Rose & Himalayan Salt, Eucalyptus & Mint and Lavender & Coconut. Pick a blend to see its jar.', ['4 blends', 'Dissolves in warm water', '250 g glass jar'], 'Glass jar with gold-tone lid', '420 g'));
  const mist = mk('body', `LUM-BD-${String(nextId + 1).padStart(3, '0')}`, `BDBM${1000 + (nextId + 1) * 37}`, s('Body Mists', 'spray', 'Revathi Herbal Body Mist', 999, 1199, 60, MIST_FL, ['100 ml'], 4.6, 52, 'New', 'Four refreshing body mists: Eucalyptus & Mint, Rose & Cucumber, Sandalwood & Saffron and Lavender & Aloe. Pick a blend to see its bottle.', ['4 blends', 'Fine, even mist', '100 ml spray bottle'], 'Spray bottle with gold-tone pump', '150 g'));
  const put = (x: Product, sub: string) => { const at = body.findIndex(y => y.subcategory === sub); body.splice(at < 0 ? body.length : at, 0, x); };
  put(soak, 'Bath & Soaks'); put(mist, 'Body Mists');
}

// Old sample products taken off the shop at the owner's request (kept only the real-photo products). Ids of the remaining products do not change.
{
  const REMOVE_FACE = new Set(['Rosée Balancing Essence', 'Nacre Pore Refining Toner', 'Éclat Daily Shield SPF 50', 'REVATHI HERBAL Mineral Veil SPF 40', 'Velvet PHA Resurfacing Gel', 'Café Enzyme Polish', 'Argile Rose Clay Mask', 'Mirage Overnight Sleeping Mask', 'Éclat Caffeine Eye Serum', 'Nuit Peptide Eye Cream', 'Baiser Peptide Lip Balm']);
  const REMOVE_BODY = new Set(['Lait de Coco Body Milk', 'Satin Dry Body Oil', 'Chaleur Ginger Massage Oil', 'Café Noir Body Scrub', 'Sucre Vanilla Sugar Scrub', 'Sel de Mer Mineral Bath Soak', 'Ambre Luxe Bath Oil', 'Velours Heel Rescue Balm', 'Pure Linen Deodorant Balm', 'Rose Neroli Body Deodorant Mist', 'Étoile Shimmer Body Mist', 'Rosée Rose Water Body Mist', 'Soleil Gradual Tan Lotion']);
  face.splice(0, face.length, ...face.filter(x => !REMOVE_FACE.has(x.name)));
  body.splice(0, body.length, ...body.filter(x => !REMOVE_BODY.has(x.name)));
}

// Tint Powder (3 shades), Jasmine Cleansing Oil and Herbal Shampoo (4 flavours), each with its own photo. Fresh ids.
{
  const TINT_FL = [ph('Beetroot Pink', '#C4607A', 'tint-powder', 'beetroot-pink'), ph('Turmeric Gold', '#B8924F', 'tint-powder', 'turmeric-gold'), ph('Charcoal Black', '#3A2A2E', 'tint-powder', 'charcoal-black')];
  const OIL_FL = [ph('Jasmine', '#E8D3A9', 'cleansing-oil', 'jasmine')];
  const SHAMPOO_FL = [ph('Hibiscus & Aloe Vera', '#D97A95', 'herbal-shampoo', 'hibiscus-aloe'), ph('Neem & Tea Tree', '#6B9A55', 'herbal-shampoo', 'neem-tea-tree'), ph('Coconut Milk & Fenugreek', '#B8924F', 'herbal-shampoo', 'coconut-fenugreek'), ph('Amla & Reetha', '#8A9A4B', 'herbal-shampoo', 'amla-reetha')];
  const nid = (arr: Product[]) => arr.reduce((m, x) => Math.max(m, Number(x.id.split('-').pop()) || 0), 0) + 1;
  let n = nid(face);
  const tint = mk('face', `LUM-FC-${String(n).padStart(3, '0')}`, `FCTP${1000 + n * 37}`, s('Makeup', 'jar', 'Herbal Tint Powder', 1199, 1499, 60, TINT_FL, ['10 g'], 4.7, 58, 'New', 'A natural tint powder in three plant-based shades: beetroot pink for cheeks and lips, turmeric gold for a warm glow and charcoal black as a natural eyeliner tint.', ['3 plant-based shades', 'Beetroot, turmeric and charcoal', 'Wooden-lid glass jar'], 'Glass jar with wooden lid', '60 g'));
  n += 1;
  const oil = mk('face', `LUM-FC-${String(n).padStart(3, '0')}`, `FCCO${1000 + n * 37}`, s('Cleansers', 'pump', 'Jasmine Cleansing Oil', 1650, 1999, 60, OIL_FL, ['100 ml'], 4.8, 64, 'New', 'A silky cleansing oil that melts away makeup and the day, scented with white jasmine.', ['White jasmine', 'Melts makeup and sunscreen', 'Pump bottle'], 'Glass pump bottle', '220 g'));
  const atT = face.findIndex(x => x.subcategory === 'Makeup'); face.splice(atT < 0 ? face.length : atT, 0, tint);
  const atO = face.findIndex(x => x.subcategory === 'Cleansers'); face.splice(atO < 0 ? face.length : atO, 0, oil);
  const bn = nid(body);
  const shampoo = mk('body', `LUM-BD-${String(bn).padStart(3, '0')}`, `BDHS${1000 + bn * 37}`, s('Hair Care', 'pump', 'Herbal Shampoo', 899, 1099, 60, SHAMPOO_FL, ['250 ml'], 4.7, 72, 'New', 'Four herbal shampoos: Hibiscus & Aloe Vera, Neem & Tea Tree, Coconut Milk & Fenugreek and Amla & Reetha. Pick a flavour to see its bottle.', ['4 herbal flavours', 'Sulfate free', 'Vegan'], 'Pump bottle', '300 g'));
  body.unshift(shampoo);
}

// Products removed from the shop page at the owner's request.
{
  const GONE_FACE = new Set(['REVATHI HERBAL Skin Tint SPF 30', 'Atelier Nude Eyeshadow Palette', 'Velours Soft-Matte Blush', 'Velours Blur Makeup Primer', 'REVATHI HERBAL Silk Foundation', 'Éclat Cream Concealer', 'Rose Veil Powder Blush', 'Soleil Sculpt Bronzer', 'Nacre Glow Highlighter', 'Graphite Precision Liner', 'Miroir Glass Lip Gloss', 'Brume Makeup Setting Mist']);
  const GONE_WELLNESS = new Set(['Calme Lavender Essential Oil', 'Équilibre Eucalyptus Essential Oil', 'Brume Pillow & Linen Mist', 'Sel de Mer Mineral Bath Salts', 'Rose Milk Bath Soak', 'Santal No. 07 Soy Candle', 'Rose Atelier Candle', 'Cèdre Rain Candle', 'Dream Tea Night Blend', 'Nocturne Magnesium Bath Flakes', 'Warm Ginger Massage Oil', 'REVATHI HERBAL Glass Water Bottle', 'Hydra Electrolyte Sachets', 'Quiet Morning Journal', 'Golden Hour Ritual Candle']);
  face.splice(0, face.length, ...face.filter(x => !GONE_FACE.has(x.name)));
  wellness.splice(0, wellness.length, ...wellness.filter(x => !GONE_WELLNESS.has(x.name)));
}

export const PRODUCTS: Record<CategoryKey, Product[]> = { face, 'wellness products': wellness, body };

// Products added by admin (Admin > Products > Add product). They join the same catalogue the shop sells.
const addedSeed = (a: Added): Seed => ({ n: a.name, sub: a.subcategory, art: 'jar', price: a.price, mrp: a.mrp, stock: a.stock, colours: [OAT], sizes: ['Standard'], rating: 0, reviews: 0, badge: 'New', description: a.description, details: [], material: '', weight: '' });
getAdded().slice().reverse().forEach(a => PRODUCTS[a.category].unshift(mk(a.category, a.id, a.sku, addedSeed(a))));

/** Every product in the catalogue, archived ones included (admin). */
export const catalogue = (): Product[] => Object.values(PRODUCTS).flat();
/** Products that can be sold or shown: not archived and not a draft. */
export const sellable = (): Product[] => catalogue().filter(p => !p.archived && p.status !== 'Draft');

export interface NewProduct { name: string; category: CategoryKey; subcategory: string; mrp: number; price: number; discountType: 'flat' | 'percent'; discountValue: number; stock: number; description: string; status: 'Active' | 'Draft'; image?: string }
export function createProduct(d: NewProduct): Product {
  const n = getAdded().reduce((m, a) => Math.max(m, Number(a.id.split('-').pop()) || 0), 0) + 1;
  const a: Added = { id: `LUM-NEW-${String(n).padStart(3, '0')}`, sku: `NEW${1000 + n}`, category: d.category, subcategory: d.subcategory, name: d.name, description: d.description, mrp: d.mrp, price: d.price, stock: d.stock };
  saveAdded(a);
  setPatch(a.id, { discountType: d.discountType, discountValue: d.discountValue, status: d.status, ...(d.image ? { image: d.image } : {}) });
  const p = mk(a.category, a.id, a.sku, addedSeed(a));
  PRODUCTS[a.category].unshift(p);
  return p;
}

export const formatPrice = (n: number) => `₹${n.toLocaleString('en-IN')}`;
export const discount = (p: Product) => Math.round(((p.mrp - p.price) / p.mrp) * 100);
export const stockStatus = (n: number) => n === 0
  ? { label: 'Out of stock', tone: 'text-red-700', bar: 'bg-red-500' }
  : n <= getThreshold()
    ? { label: `Only ${n} left`, tone: 'text-amber-700', bar: 'bg-amber-500' }
    : { label: `In stock · ${n} units`, tone: 'text-emerald-700', bar: 'bg-emerald-600' };


export const findProduct = (id: string): Product | undefined => Object.values(PRODUCTS).flat().find(p => p.id === id);

/** After a paid order: take the ordered quantity off the stock (all colours / sizes of a product share one stock number).
 *  Reaching 0 means the product turns "Out of stock" on the shop; staff can restock it from the Inventory page.
 *  BACKEND: done inside the order transaction on the server. */
export function deductStockForOrder(items: { product: { id: string }; qty: number }[]) {
  const perProduct = new Map<string, number>();
  items.forEach(i => perProduct.set(i.product.id, (perProduct.get(i.product.id) ?? 0) + i.qty));
  perProduct.forEach((qty, id) => {
    const p = findProduct(id);
    if (!p) return; // not a catalogue product, nothing to deduct
    adjustStock({ id: p.id, sku: p.sku, name: p.name }, p.baseStock ?? p.stock, Math.max(0, p.stock - qty));
  });
}
