'use client';

import { useMemo, useState } from 'react';
import { Button, cx } from '@lulwah/ui';
import { ApiError } from '@/lib/api-client';
import { rememberCartLineDisplay } from '@/lib/cart-display-cache';
import type { VariantWithAvailability } from '@/lib/catalog-schemas';
import { useAddCartItem } from '@/hooks/use-cart';
import { QuantityStepper } from './QuantityStepper';
import { WishlistButton } from './WishlistButton';

/**
 * plan.md §15.4 info column items 5–10: colour/size selection, stock line,
 * quantity + Add to bag, delivery estimator. Client component. The cart
 * mutation is now the real `POST /cart/:cartId/items` (`useAddCartItem`,
 * `hooks/use-cart.ts`) — a cart is created lazily on first add (`POST
 * /cart`, cookie round-trips automatically) rather than requiring one to
 * already exist. The *data* driving colour/size/stock is the real PDP
 * payload: `variants` is `GET /products/:slug`'s live
 * `VariantWithAvailability[]` (`product.dto.ts`), so the stock line
 * ("Only N left" / "Sold out") reflects real inventory per the selected
 * colour/size combination, not a single static `totalStock` number.
 *
 * Colour options render as bordered name buttons, not hex swatches: only
 * the product's own primary colourway has a known hex (`product.colorHex`)
 * — a variant's `options.color` is just a SKU-level string with no
 * accompanying hex anywhere in `@lulwah/contracts` — so swatches would mean
 * fabricating colour for every option but the first.
 *
 * Deviation: the "Size guide" control (§15.4 item 6) is a plain label
 * here, not a working drawer with the brand's chart — that's real content
 * (per-brand measurement tables) this workstream has no source for yet.
 */
export interface AddToBagFormProps {
  productSlug: string;
  brandName: string;
  title: string;
  stitchingType: string;
  pieceCount: 1 | 2 | 3 | null;
  image: { src: string; alt: string };
  variants: VariantWithAvailability[];
  /** Used only when a product somehow has zero active variants — shouldn't
   *  happen against real seed data, but keeps this component from crashing
   *  if it does. */
  fallbackPriceFils: number;
  fallbackCompareAtPriceFils: number | null;
}

const LOW_STOCK_THRESHOLD = 3;

function estimateDeliveryDayLabel(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function AddToBagForm({
  productSlug,
  brandName,
  title,
  stitchingType,
  image,
  variants,
}: AddToBagFormProps) {
  const colorOptions = useMemo(
    () => Array.from(new Set(variants.map((v) => v.options.color).filter((c): c is string => Boolean(c)))),
    [variants],
  );
  const sizeOptions = useMemo(
    () => Array.from(new Set(variants.map((v) => v.options.size).filter((s): s is NonNullable<typeof s> => Boolean(s)))),
    [variants],
  );

  const [selectedColor, setSelectedColor] = useState<string | null>(colorOptions[0] ?? null);
  const [selectedSize, setSelectedSize] = useState<string | null>(sizeOptions[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const addCartItem = useAddCartItem();

  const matchedVariant: VariantWithAvailability | undefined =
    variants.find(
      (v) =>
        (colorOptions.length === 0 || v.options.color === selectedColor) &&
        (sizeOptions.length === 0 || v.options.size === selectedSize),
    ) ?? variants[0];

  const available = matchedVariant?.available ?? 0;
  const allowBackorder = matchedVariant?.allowBackorder ?? false;
  const inStock = available > 0 || allowBackorder;
  const isLowStock = available > 0 && available <= LOW_STOCK_THRESHOLD;
  const maxQuantity = Math.max(1, Math.min(10, available > 0 ? available : allowBackorder ? 10 : 1));

  async function handleAddToBag() {
    if (!matchedVariant) return;
    // Remember display data for this variant — the cart API's `CartItem`
    // has no title/brand/image snapshot (see `cart-display-cache.ts`'s doc
    // comment); this is purely cosmetic, never consulted for price/qty.
    rememberCartLineDisplay(matchedVariant.id, {
      productSlug,
      brandName,
      title,
      image,
      stitchingType,
      ...(selectedColor ? { colorName: selectedColor } : {}),
      ...(selectedSize ? { size: selectedSize } : {}),
    });
    try {
      await addCartItem.mutateAsync({ variantId: matchedVariant.id, quantity });
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 2400);
    } catch {
      // Surfaced via `addCartItem.error` below — swallow here so the
      // rejection doesn't also reach the console as an unhandled promise.
    }
  }

  const addToBagErrorMessage =
    addCartItem.error instanceof ApiError ? addCartItem.error.message : addCartItem.error ? 'Something went wrong. Please try again.' : null;

  return (
    <div className="flex flex-col gap-24">
      {colorOptions.length > 0 ? (
        <fieldset className="flex flex-col gap-8">
          <legend className="font-body text-label font-semibold tracking-label text-ink uppercase">
            Colour{selectedColor ? `: ${selectedColor}` : ''}
          </legend>
          <div className="flex flex-wrap gap-8">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                aria-pressed={selectedColor === color}
                onClick={() => setSelectedColor(color)}
                className={cx(
                  'flex h-48 items-center justify-center border px-16 font-body text-body-sm transition-colors duration-fast ease-out',
                  selectedColor === color ? 'border-zamurrad bg-zamurrad text-paper' : 'border-ink-20 text-ink hover:border-ink',
                )}
              >
                {color}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {sizeOptions.length > 0 ? (
        <fieldset className="flex flex-col gap-8">
          <div className="flex items-baseline justify-between">
            <legend className="font-body text-label font-semibold tracking-label text-ink uppercase">Size</legend>
            <span className="font-body text-body-sm text-ink underline decoration-1 underline-offset-4">
              Size guide
            </span>
          </div>
          <div className="flex flex-wrap gap-8">
            {sizeOptions.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={selectedSize === size}
                onClick={() => setSelectedSize(size)}
                className={cx(
                  'flex h-48 min-w-48 items-center justify-center border px-12 font-body text-body-sm transition-colors duration-fast ease-out',
                  selectedSize === size ? 'border-zamurrad bg-zamurrad text-paper' : 'border-ink-20 text-ink hover:border-ink',
                )}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <p className="font-body text-body-sm font-medium" aria-live="polite">
        {!inStock ? (
          <span className="text-mukaish">
            Sold out.{' '}
            <button type="button" className="text-ink underline decoration-1 underline-offset-4">
              notify me
            </button>
          </span>
        ) : isLowStock ? (
          <span className="text-garnet">Only {available} left</span>
        ) : (
          <span className="text-success">In stock</span>
        )}
      </p>

      <div className="flex items-center gap-16">
        <QuantityStepper label="Quantity" quantity={quantity} onChange={setQuantity} max={maxQuantity} />
        <Button
          type="button"
          onClick={() => void handleAddToBag()}
          disabled={!inStock || addCartItem.isPending}
          className="flex-1"
        >
          {addCartItem.isPending ? 'Adding…' : justAdded ? 'Added to bag' : inStock ? 'Add to bag' : 'Sold out'}
        </Button>
        <WishlistButton productSlug={productSlug} productTitle={title} />
      </div>

      {addToBagErrorMessage ? (
        <p role="alert" className="font-body text-body-sm text-danger">
          {addToBagErrorMessage}
        </p>
      ) : null}

      <p className="font-body text-body-sm text-mukaish">
        Order in the next few hours for delivery by {estimateDeliveryDayLabel()} to Dubai.
      </p>
    </div>
  );
}
