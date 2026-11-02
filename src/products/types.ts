export type CategoryKey = 'face' | 'wellness products' | 'body';

export type ArtType =
  | 'dropper' | 'jar' | 'tube' | 'pump' | 'stick'
  | 'spray' | 'bottle' | 'compact' | 'palette' | 'lipstick' | 'gloss' | 'candle' | 'box';

export interface Colour { name: string; hex: string; code?: string; photo?: string } // code = shade serial no. (R1, N2...), photo = shade-specific image

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: CategoryKey;
  subcategory: string;
  art: ArtType;
  price: number;
  mrp: number;
  stock: number;
  forcedOut?: boolean; // admin set the product Out of stock by hand (stock getter then reads 0)
  baseStock?: number; // the catalogue's own number; admin changes are layered on top (api/stock.ts)
  colours: Colour[];
  sizes: string[];
  rating: number;
  reviews: number;
  badge?: string;
  description: string;
  details: string[];
  material: string;
  weight: string;
  archived?: boolean; // hidden from the shop by admin (CRS 4.1 archive)
  status?: 'Active' | 'Draft';
  discountType?: 'flat' | 'percent';
  discountValue?: number;
}

export interface CartItem { key: string; product: Product; colour: Colour; size: string; qty: number }
export interface Address { name: string; email: string; phone: string; line1: string; line2: string; city: string; state: string; pin: string; method: 'standard' | 'express' }
export interface Order { id: string; items: CartItem[]; address: Address; pay: string; subtotal: number; shipping: number; fee: number; discount?: number; coupon?: string; total: number; date: string; eta: string }
