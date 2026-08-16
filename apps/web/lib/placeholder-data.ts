import type { ProductCardColor, ProductCardProps } from '@/components/commerce/ProductCard';

/**
 * Placeholder catalogue data — plan.md's "cart/checkout/PDP can use local
 * component state / placeholder data" (Out of scope note). Shaped close to
 * `@lulwah/contracts`' `Product`/`Variant` schemas so swapping this module
 * for a real `apiFetch` call later is a small, mechanical change, but kept
 * as a lighter hand-written type here rather than the full contract shape
 * — every field below is one this storefront skeleton actually renders.
 *
 * Images point at plausible-looking paths under an imgproxy source bucket
 * that doesn't exist yet (`lib/image-loader.ts` builds the URL regardless
 * — see that file's doc comment). Copy is written in the store's voice
 * (plan.md §13.2: "specific copy... not lorem ipsum"), not real brand
 * catalogue data.
 */

export type StitchingType = 'unstitched' | 'semi_stitched' | 'pret' | 'custom_stitchable';

export interface PlaceholderProduct {
  slug: string;
  articleCode: string;
  brandName: string;
  brandSlug: string;
  title: string;
  stitchingType: StitchingType;
  pieceCount: 1 | 2 | 3 | null;
  fabric: string;
  work: string[];
  occasion: string[];
  dupattaType: string | null;
  colorName: string;
  colorFamily: string;
  colors: ProductCardColor[];
  sizes: string[];
  priceFils: number;
  compareAtPriceFils: number | null;
  totalStock: number;
  images: { src: string; alt: string }[];
  badges: ('new' | 'bestseller' | 'limited' | 'last_pieces')[];
  descriptionEn: string;
  fabricCare: string;
  piecesBreakdown: { type: string; fabric: string; lengthMeters: number | null }[];
}

export interface PlaceholderBrand {
  name: string;
  slug: string;
  countryOfOrigin: 'PK';
}

export const BRANDS: PlaceholderBrand[] = [
  { name: 'Khaadi', slug: 'khaadi', countryOfOrigin: 'PK' },
  { name: 'Asim Jofa', slug: 'asim-jofa', countryOfOrigin: 'PK' },
  { name: 'Sana Safinaz', slug: 'sana-safinaz', countryOfOrigin: 'PK' },
  { name: 'Maria B', slug: 'maria-b', countryOfOrigin: 'PK' },
  { name: 'Gul Ahmed', slug: 'gul-ahmed', countryOfOrigin: 'PK' },
  { name: 'Elan', slug: 'elan', countryOfOrigin: 'PK' },
];

function img(slug: string, index: number, label: string): { src: string; alt: string } {
  return { src: `/catalogue/${slug}-${index}.jpg`, alt: label };
}

export const PRODUCTS: PlaceholderProduct[] = [
  {
    slug: 'khaadi-ferozi-lawn-3-piece',
    articleCode: 'KHAS-26-107',
    brandName: 'Khaadi',
    brandSlug: 'khaadi',
    title: 'Ferozi Embroidered Lawn, 3 Piece',
    stitchingType: 'unstitched',
    pieceCount: 3,
    fabric: 'lawn',
    work: ['digital_print', 'hand_embroidery'],
    occasion: ['everyday', 'casual'],
    dupattaType: 'chiffon',
    colorName: 'Ferozi',
    colorFamily: 'blue_ferozi',
    colors: [
      { name: 'Ferozi', hex: '#1F7A8C' },
      { name: 'Off White', hex: '#F2EFE9' },
      { name: 'Mehndi Green', hex: '#5B6B3A' },
    ],
    sizes: [],
    priceFils: 24_900,
    compareAtPriceFils: 34_900,
    totalStock: 14,
    images: [img('khaadi-ferozi', 1, 'Ferozi embroidered lawn suit, front'), img('khaadi-ferozi', 2, 'Ferozi embroidered lawn suit, styled with dupatta')],
    badges: ['new'],
    descriptionEn:
      "The shirt front carries a hand-embroidered neckline over Khaadi's signature digital lawn print; the dupatta is chiffon, not the printed cotton this print usually ships with.",
    fabricCare: 'Lawn shirt and trouser, chiffon dupatta. Hand wash cold, dry in shade, cool iron on the print.',
    piecesBreakdown: [
      { type: 'shirt', fabric: 'Lawn', lengthMeters: 3.25 },
      { type: 'trouser', fabric: 'Cambric', lengthMeters: 2.5 },
      { type: 'dupatta', fabric: 'Chiffon', lengthMeters: 2.5 },
    ],
  },
  {
    slug: 'asim-jofa-mehndi-green-3-piece',
    articleCode: 'AJ-LAWN-26-3B',
    brandName: 'Asim Jofa',
    brandSlug: 'asim-jofa',
    title: 'Mehndi Green Karandi, 3 Piece',
    stitchingType: 'unstitched',
    pieceCount: 3,
    fabric: 'karandi',
    work: ['zari', 'resham'],
    occasion: ['festive', 'eid'],
    dupattaType: 'organza',
    colorName: 'Mehndi Green',
    colorFamily: 'green',
    colors: [
      { name: 'Mehndi Green', hex: '#5B6B3A' },
      { name: 'Maroon', hex: '#6E1F2A' },
    ],
    sizes: [],
    priceFils: 42_500,
    compareAtPriceFils: null,
    totalStock: 6,
    images: [img('aj-mehndi', 1, 'Mehndi green karandi suit with zari embroidery')],
    badges: ['limited'],
    descriptionEn:
      'Zari and resham work on karandi — heavier than lawn, cut for festive daywear rather than high-summer heat. The organza dupatta is finished on all four sides.',
    fabricCare: 'Karandi shirt and trouser, organza dupatta. Dry clean recommended for the embroidered panel.',
    piecesBreakdown: [
      { type: 'shirt', fabric: 'Karandi', lengthMeters: 3.5 },
      { type: 'trouser', fabric: 'Karandi', lengthMeters: 2.5 },
      { type: 'dupatta', fabric: 'Organza', lengthMeters: 2.5 },
    ],
  },
  {
    slug: 'sana-safinaz-powder-pink-kurti',
    articleCode: 'SS-PRET-26-041',
    brandName: 'Sana Safinaz',
    brandSlug: 'sana-safinaz',
    title: 'Powder Pink Embroidered Kurti',
    stitchingType: 'pret',
    pieceCount: null,
    fabric: 'cotton_net',
    work: ['machine_embroidery', 'sequins'],
    occasion: ['workwear', 'casual'],
    dupattaType: 'none',
    colorName: 'Powder Pink',
    colorFamily: 'pink',
    colors: [
      { name: 'Powder Pink', hex: '#E7B8C0' },
      { name: 'Ivory', hex: '#F4EFE6' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    priceFils: 18_900,
    compareAtPriceFils: 21_900,
    totalStock: 22,
    images: [img('ss-kurti', 1, 'Powder pink embroidered kurti, front')],
    badges: ['bestseller'],
    descriptionEn:
      'A single-piece kurti in Sana Safinaz\'s standard pret sizing — true to the brand\'s own chart, which runs closer to a UK 8 at Small.',
    fabricCare: 'Cotton net with embroidered yoke. Hand wash separately in cold water for the first three washes.',
    piecesBreakdown: [{ type: 'shirt', fabric: 'Cotton net', lengthMeters: null }],
  },
  {
    slug: 'maria-b-royal-blue-formal',
    articleCode: 'MB-FEST-26-019',
    brandName: 'Maria B',
    brandSlug: 'maria-b',
    title: 'Royal Blue Jamawar, 3 Piece',
    stitchingType: 'custom_stitchable',
    pieceCount: 3,
    fabric: 'jamawar',
    work: ['tilla', 'dabka', 'sequins'],
    occasion: ['barat', 'walima', 'bridal'],
    dupattaType: 'net',
    colorName: 'Royal Blue',
    colorFamily: 'blue_ferozi',
    colors: [
      { name: 'Royal Blue', hex: '#1E3A8A' },
      { name: 'Wine', hex: '#5C1A2B' },
      { name: 'Emerald', hex: '#0E3B30' },
    ],
    sizes: [],
    priceFils: 89_000,
    compareAtPriceFils: 105_000,
    totalStock: 3,
    images: [img('mb-royal', 1, 'Royal blue jamawar formal suit with tilla work'), img('mb-royal', 2, 'Royal blue jamawar formal suit, dupatta detail')],
    badges: ['limited', 'last_pieces'],
    descriptionEn:
      'Heavy jamawar with hand-set tilla and dabka on the shirt front and border. We stitch to your measurements — allow 10–14 days.',
    fabricCare: 'Jamawar shirt and trouser, net dupatta with tilla border. Dry clean only.',
    piecesBreakdown: [
      { type: 'shirt', fabric: 'Jamawar', lengthMeters: 3.5 },
      { type: 'trouser', fabric: 'Raw silk', lengthMeters: 2.5 },
      { type: 'dupatta', fabric: 'Net', lengthMeters: 2.75 },
    ],
  },
  {
    slug: 'gul-ahmed-ivory-cambric-2-piece',
    articleCode: 'GA-SUM-26-233',
    brandName: 'Gul Ahmed',
    brandSlug: 'gul-ahmed',
    title: 'Ivory Cambric, 2 Piece',
    stitchingType: 'unstitched',
    pieceCount: 2,
    fabric: 'cambric',
    work: ['screen_print'],
    occasion: ['everyday'],
    dupattaType: 'none',
    colorName: 'Ivory',
    colorFamily: 'white_offwhite',
    colors: [
      { name: 'Ivory', hex: '#F4EFE6' },
      { name: 'Powder Blue', hex: '#B7CDE0' },
    ],
    sizes: [],
    priceFils: 12_900,
    compareAtPriceFils: null,
    totalStock: 31,
    images: [img('ga-ivory', 1, 'Ivory cambric two-piece suit, screen print detail')],
    badges: [],
    descriptionEn: 'Shirt and trouser only — pair the shirt with a dupatta from our Dupattas & Shawls edit, or wear it as a kurti over jeans.',
    fabricCare: 'Cambric shirt and trouser. Machine washable, cold, inside out.',
    piecesBreakdown: [
      { type: 'shirt', fabric: 'Cambric', lengthMeters: 3.25 },
      { type: 'trouser', fabric: 'Cambric', lengthMeters: 2.5 },
    ],
  },
  {
    slug: 'elan-noir-organza-gharara',
    articleCode: 'ELN-BRD-26-006',
    brandName: 'Elan',
    brandSlug: 'elan',
    title: 'Noir Organza Gharara Set',
    stitchingType: 'pret',
    pieceCount: null,
    fabric: 'organza',
    work: ['hand_embroidery', 'mirror_work'],
    occasion: ['nikkah', 'party'],
    dupattaType: 'organza',
    colorName: 'Noir',
    colorFamily: 'black',
    colors: [{ name: 'Noir', hex: '#131311' }],
    sizes: ['S', 'M', 'L'],
    priceFils: 68_000,
    compareAtPriceFils: 76_000,
    totalStock: 5,
    images: [img('elan-noir', 1, 'Noir organza gharara set with mirror work')],
    badges: ['bestseller'],
    descriptionEn: 'Mirror work over hand embroidery on a fully-stitched gharara set — Elan\'s standard formal sizing, ready to wear.',
    fabricCare: 'Organza shirt, gharara and dupatta. Dry clean only, store on a padded hanger.',
    piecesBreakdown: [{ type: 'shirt', fabric: 'Organza', lengthMeters: null }],
  },
  {
    slug: 'khaadi-off-white-khaddar-3-piece',
    articleCode: 'KHAS-25-088',
    brandName: 'Khaadi',
    brandSlug: 'khaadi',
    title: 'Off White Khaddar, 3 Piece',
    stitchingType: 'unstitched',
    pieceCount: 3,
    fabric: 'khaddar',
    work: ['block_print', 'hand_embroidery'],
    occasion: ['everyday', 'casual'],
    dupattaType: 'printed',
    colorName: 'Off White',
    colorFamily: 'white_offwhite',
    colors: [
      { name: 'Off White', hex: '#F2EFE9' },
      { name: 'Rust', hex: '#A65C32' },
    ],
    sizes: [],
    priceFils: 27_500,
    compareAtPriceFils: 27_500,
    totalStock: 0,
    images: [img('khaadi-khaddar', 1, 'Off white khaddar winter suit with block print')],
    badges: [],
    descriptionEn: 'Khaddar holds heat better than lawn — this is a winter-weight suit, block-printed by hand in Karachi.',
    fabricCare: 'Khaddar shirt and trouser, printed cotton dupatta. Hand wash cold, first wash separately.',
    piecesBreakdown: [
      { type: 'shirt', fabric: 'Khaddar', lengthMeters: 3.25 },
      { type: 'trouser', fabric: 'Khaddar', lengthMeters: 2.5 },
      { type: 'dupatta', fabric: 'Khaddar', lengthMeters: 2.5 },
    ],
  },
  {
    slug: 'asim-jofa-banarsi-bridal-3-piece',
    articleCode: 'AJ-BRD-26-002',
    brandName: 'Asim Jofa',
    brandSlug: 'asim-jofa',
    title: 'Banarsi Bridal, 3 Piece',
    stitchingType: 'custom_stitchable',
    pieceCount: 3,
    fabric: 'banarsi',
    work: ['zari', 'gota', 'sequins'],
    occasion: ['bridal', 'walima'],
    dupattaType: 'silk',
    colorName: 'Deep Maroon',
    colorFamily: 'red_maroon',
    colors: [
      { name: 'Deep Maroon', hex: '#5C1A2B' },
      { name: 'Gold', hex: '#B8862B' },
    ],
    sizes: [],
    priceFils: 145_000,
    compareAtPriceFils: 165_000,
    totalStock: 2,
    images: [img('aj-banarsi', 1, 'Deep maroon banarsi bridal suit with gold zari work')],
    badges: ['limited', 'last_pieces'],
    descriptionEn: 'Woven banarsi with hand-set gota and zari border. Two pieces left in this colourway — stitching adds 10–14 days.',
    fabricCare: 'Banarsi shirt and trouser, pure silk dupatta. Dry clean only.',
    piecesBreakdown: [
      { type: 'shirt', fabric: 'Banarsi', lengthMeters: 3.5 },
      { type: 'trouser', fabric: 'Raw silk', lengthMeters: 2.5 },
      { type: 'dupatta', fabric: 'Silk', lengthMeters: 2.75 },
    ],
  },
  {
    slug: 'maria-b-mustard-chiffon-2-piece',
    articleCode: 'MB-FEST-26-071',
    brandName: 'Maria B',
    brandSlug: 'maria-b',
    title: 'Mustard Chiffon, 2 Piece',
    stitchingType: 'semi_stitched',
    pieceCount: 2,
    fabric: 'chiffon',
    work: ['digital_print', 'sequins'],
    occasion: ['festive', 'party'],
    dupattaType: 'chiffon',
    colorName: 'Mustard',
    colorFamily: 'yellow_mustard',
    colors: [{ name: 'Mustard', hex: '#C99A2E' }],
    sizes: ['free'],
    priceFils: 21_900,
    compareAtPriceFils: null,
    totalStock: 9,
    images: [img('mb-mustard', 1, 'Mustard chiffon semi-stitched suit')],
    badges: ['new'],
    descriptionEn: 'Shirt front is pre-stitched at the neckline and sides — finish the hem and sleeves to your length.',
    fabricCare: 'Chiffon shirt, chiffon dupatta. Hand wash cold, hang dry away from direct sun.',
    piecesBreakdown: [
      { type: 'shirt', fabric: 'Chiffon', lengthMeters: 3.0 },
      { type: 'dupatta', fabric: 'Chiffon', lengthMeters: 2.5 },
    ],
  },
];

export function getProductBySlug(slug: string): PlaceholderProduct | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function getRelatedProducts(slug: string, limit = 4): PlaceholderProduct[] {
  return PRODUCTS.filter((product) => product.slug !== slug).slice(0, limit);
}

const PLACEHOLDER_IMAGE = { src: '/catalogue/placeholder.jpg', alt: '' };

/** Maps the placeholder catalogue shape to `ProductCard`'s props — the one seam a real `apiFetch('/products', ...)` call would replace. */
export function toProductCardProps(product: PlaceholderProduct, locale: 'en' | 'ar'): ProductCardProps {
  const [primaryImage, secondaryImage] = product.images;
  return {
    slug: product.slug,
    brandName: product.brandName,
    title: product.title,
    image: primaryImage ?? { ...PLACEHOLDER_IMAGE, alt: product.title },
    hoverImage: secondaryImage,
    priceFils: product.priceFils,
    compareAtPriceFils: product.compareAtPriceFils,
    colors: product.colors,
    availableSizes: product.stitchingType === 'pret' ? product.sizes : [],
    locale,
  };
}
