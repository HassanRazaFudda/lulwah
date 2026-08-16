'use client';

import { useState } from 'react';
import { Button, cx } from '@lulwah/ui';
import type { PlaceholderProduct } from '@/lib/placeholder-data';
import { useCartStore } from '@/stores/cart-store';
import { QuantityStepper } from './QuantityStepper';
import { WishlistButton } from './WishlistButton';

/**
 * plan.md §15.4 info column items 5–10: colour swatches, size selector
 * (pret only), stock line, quantity + Add to bag, delivery estimator.
 * Client component — colour/size selection and the cart mutation are all
 * local interaction, no server round trip in this skeleton (`useCartStore`,
 * see that file's doc comment for the real-cart migration path).
 *
 * Deviation: the "Size guide" control (§15.4 item 6) is a plain label
 * here, not a working drawer with the brand's chart — that's real content
 * (per-brand measurement tables) this workstream has no source for yet.
 */
export interface AddToBagFormProps {
  product: PlaceholderProduct;
}

function estimateDeliveryDayLabel(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function AddToBagForm({ product }: AddToBagFormProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(product.colors[0]?.name ?? null);
  const [selectedSize, setSelectedSize] = useState<string | null>(product.sizes[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  const isPret = product.stitchingType === 'pret';
  const inStock = product.totalStock > 0;
  const isLowStock = inStock && product.totalStock <= 3;
  const maxQuantity = Math.max(1, Math.min(10, product.totalStock || 1));

  function handleAddToBag() {
    const lineId = [product.slug, selectedColor, selectedSize].filter(Boolean).join('::');
    addItem({
      id: lineId,
      productSlug: product.slug,
      brandName: product.brandName,
      title: product.title,
      image: product.images[0] ?? { src: '/catalogue/placeholder.jpg', alt: product.title },
      stitchingType: product.stitchingType,
      pieceCount: product.pieceCount,
      ...(selectedColor ? { colorName: selectedColor } : {}),
      ...(selectedSize ? { size: selectedSize } : {}),
      quantity,
      unitPriceFils: product.priceFils,
      compareAtPriceFils: product.compareAtPriceFils,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2400);
  }

  return (
    <div className="flex flex-col gap-24">
      {product.colors.length > 0 ? (
        <fieldset className="flex flex-col gap-8">
          <legend className="font-body text-label font-semibold tracking-label text-ink uppercase">
            Colour{selectedColor ? ` — ${selectedColor}` : ''}
          </legend>
          <div className="flex flex-wrap gap-8">
            {product.colors.map((color) => (
              <button
                key={color.name}
                type="button"
                title={color.name}
                aria-pressed={selectedColor === color.name}
                aria-label={color.name}
                onClick={() => setSelectedColor(color.name)}
                className={cx(
                  'size-32 rounded-full border-2 p-2 transition-colors duration-fast ease-out',
                  selectedColor === color.name ? 'border-zamurrad' : 'border-transparent',
                )}
              >
                <span
                  className="block size-full rounded-full border border-line"
                  style={{ backgroundColor: color.hex }}
                />
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {isPret && product.sizes.length > 0 ? (
        <fieldset className="flex flex-col gap-8">
          <div className="flex items-baseline justify-between">
            <legend className="font-body text-label font-semibold tracking-label text-ink uppercase">Size</legend>
            <span className="font-body text-body-sm text-ink underline decoration-1 underline-offset-4">
              Size guide
            </span>
          </div>
          <div className="flex flex-wrap gap-8">
            {product.sizes.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={selectedSize === size}
                onClick={() => setSelectedSize(size)}
                className={cx(
                  'flex h-40 min-w-40 items-center justify-center border px-12 font-body text-body-sm transition-colors duration-fast ease-out',
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
            Sold out —{' '}
            <button type="button" className="text-ink underline decoration-1 underline-offset-4">
              notify me
            </button>
          </span>
        ) : isLowStock ? (
          <span className="text-garnet">Only {product.totalStock} left</span>
        ) : (
          <span className="text-success">In stock</span>
        )}
      </p>

      <div className="flex items-center gap-16">
        <QuantityStepper label="Quantity" quantity={quantity} onChange={setQuantity} max={maxQuantity} />
        <Button type="button" onClick={handleAddToBag} disabled={!inStock} className="flex-1">
          {justAdded ? 'Added to bag' : inStock ? 'Add to bag' : 'Sold out'}
        </Button>
        <WishlistButton productSlug={product.slug} productTitle={product.title} />
      </div>

      <p className="font-body text-body-sm text-mukaish">
        Order in the next few hours for delivery by {estimateDeliveryDayLabel()} to Dubai.
      </p>
    </div>
  );
}
