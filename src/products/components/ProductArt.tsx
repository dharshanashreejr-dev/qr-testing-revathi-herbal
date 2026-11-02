import type { ArtType } from '../types';
import { useLang, tr, type Tr } from '../../shared/i18n';

/**
 * Real product photography only (no vectors / illustrations).
 * Every product colour has its own photo:
 *  1. hand-picked colour photos (serum, cream, blush) are used where they exist,
 *  2. otherwise a colour-graded photo from /assets/products/colour/<art>-<colour>.webp is used
 *     (generated from the real product photos, so the PRODUCT itself changes colour, not just the backdrop).
 */
const CURATED: Partial<Record<ArtType, Record<string, string>>> = {
  dropper: {
    Rose: '/assets/products/variants/serum-rose.png',
    Blush: '/assets/products/variants/serum-rose.png',
    Amber: '/assets/products/variants/serum-orange.png',
    Clay: '/assets/products/variants/serum-orange.png',
    Sage: '/assets/products/variants/serum-aloe.png',
  },
  compact: {
    Peach: '/assets/products/variants/blush-peach.png',
    Rose: '/assets/products/variants/blush-pink.png',
    Berry: '/assets/products/variants/blush-mauve.png',
  },
  jar: {
    Sky: '/assets/products/variants/cream-hydrating.png',
    Blush: '/assets/products/variants/cream-brightening.png',
    Rose: '/assets/products/variants/cream-brightening.png',
    Oat: '/assets/products/variants/cream-nourishing.png',
  },
};

const FALLBACK = '/assets/products/variants/cream-nourishing.png';
export const photoFor = (art: ArtType, colourName?: string, photo?: string) => {
  if (photo) return photo; // shade-specific photo (lipstick shades)
  if ((art as string).startsWith('data:')) return art as string; // photo uploaded by admin
  if ((art as string).startsWith('photo:')) return `/assets/products/${(art as string).slice(6)}.webp`;
  const n = (colourName ?? '').toLowerCase();
  return CURATED[art]?.[colourName ?? ''] ?? (n ? `/assets/products/colour/${art}-${n}.webp` : FALLBACK);
};

const GENERIC_ALT: Tr = {
  en: 'Product photo',
  ta: 'பொருளின் புகைப்படம்',
  hi: 'प्रोडक्ट की फ़ोटो',
  ml: 'ഉൽപ്പന്നത്തിന്റെ ഫോട്ടോ',
  te: 'ఉత్పత్తి ఫోటో',
};

interface Props {
  art: ArtType;
  colour: string; // hex
  colourName?: string;
  photo?: string; // optional shade photo, overrides the colour lookup
  className?: string;
  alt?: string;
}

export default function ProductArt({ art, colourName, photo, className, alt }: Props) {
  const [lang] = useLang();

  const src = photoFor(art, colourName, photo);

  return (
    <img
      key={src}
      src={src}
      alt={alt ?? tr(GENERIC_ALT, lang)}
      loading="lazy"
      decoding="async"
      data-product-art
      style={{ transition: 'opacity 0.35s ease' }}
      className={`${className ?? ''} h-full w-full object-contain object-center`}
      onError={(e) => {
        const el = e.currentTarget;
        if (!el.src.endsWith(FALLBACK) && !el.src.startsWith('data:')) el.src = FALLBACK;
      }}
    />
  );
}
