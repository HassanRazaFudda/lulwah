import type { Brand, Product, ProductMediaItem } from '@lulwah/contracts';
import type { ProductCardImage, ProductCardProps } from '@/components/commerce/ProductCard';

/**
 * Maps real `@lulwah/contracts` catalog entities onto the props shapes the
 * already-built commerce components expect — the "thin mapper" seam the
 * brief calls for instead of touching `ProductCard`/`PriceBlock` themselves.
 */

const FALLBACK_IMAGE: ProductCardImage = { src: '/catalogue/placeholder.svg', alt: '' };

function resolveImages(media: ProductMediaItem[], title: string): { image: ProductCardImage; hoverImage?: ProductCardImage } {
  const images = media.filter((item) => item.type === 'image');
  const primary = images.find((item) => item.isPrimary) ?? images[0];
  const hover = images.find((item) => item !== primary);
  return {
    image: primary ? { src: primary.url, alt: primary.alt || title } : { ...FALLBACK_IMAGE, alt: title },
    ...(hover ? { hoverImage: { src: hover.url, alt: '' } } : {}),
  };
}

/** `GET /products`'s list response doesn't embed the brand — only
 *  `brandId` — so every listing page (PLP, home rails, search, brand page)
 *  fetches `/brands` once and passes a lookup built from this in. */
export function buildBrandNameById(brands: Brand[]): Map<string, string> {
  return new Map(brands.map((brand) => [brand.id, brand.name]));
}

export function toProductCardProps(product: Product, brandName: string, locale: 'en' | 'ar'): ProductCardProps {
  const { image, hoverImage } = resolveImages(product.media, product.title);
  return {
    slug: product.slug,
    productId: product.id,
    brandName,
    title: product.title,
    image,
    ...(hoverImage ? { hoverImage } : {}),
    priceFils: product.effectivePriceFils,
    compareAtPriceFils: product.compareAtPriceFils,
    // A `Product` is one colourway (plan.md §7.5) — different colourways of
    // the same design are separate product docs, not swatches on one card
    // — so there is exactly one dot to show, not a multi-colour picker.
    colors: [{ name: product.colorName, hex: product.colorHex }],
    // Per-size availability lives on `Variant`, and `GET /products` doesn't
    // embed variants — the hover size-chip reveal (pret only, §13.6) can't
    // be populated without an extra per-card fetch, so it's left empty
    // rather than faked.
    availableSizes: [],
    locale,
  };
}
