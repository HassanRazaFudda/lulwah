'use client';

import { Heart } from 'lucide-react';
import { cx } from '@lulwah/ui';
import { useToggleWishlist } from '@/hooks/use-wishlist';

/**
 * The one interactive fragment of `ProductCard` — plan.md §13.6: "top-right:
 * wishlist — a hairline pearl outline, fills gold on save" and §14.4: "Pearl
 * outline fills gold; a single ring pulses out once, 380ms." Split into its
 * own client component so `ProductCard` itself can stay a Server Component;
 * this reads/writes the real server-synced wishlist (`hooks/use-wishlist.ts`,
 * `GET|POST|DELETE /me/wishlist`) directly rather than taking a callback
 * prop, which would otherwise force every RSC caller of `ProductCard` to be
 * a client component too.
 *
 * Keyed by `productId` (the real Mongo id), not `slug` — the API's wishlist
 * routes are `productId`-keyed (`AddWishlistItemInput`, `DELETE
 * /me/wishlist/:productId`); `slug` was the old localStorage-only store's
 * key and has no meaning to the real endpoint.
 */
export interface WishlistButtonProps {
  productId: string;
  productTitle: string;
  /** The variant in view when this button is clicked, if any — plan.md
   *  §7.13: a wishlist item's `variantId` is nullable, since a shopper can
   *  wishlist a product before picking a size/colour. */
  variantId?: string | null;
  className?: string;
}

export function WishlistButton({ productId, productTitle, variantId, className }: WishlistButtonProps) {
  const { isWishlisted, toggle } = useToggleWishlist(productId, variantId);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      aria-pressed={isWishlisted}
      aria-label={isWishlisted ? `Remove ${productTitle} from wishlist` : `Add ${productTitle} to wishlist`}
      className={cx(
        'group/wishlist inline-flex size-32 items-center justify-center rounded-none bg-paper/80 transition-transform duration-fast ease-out active:scale-90',
        className,
      )}
    >
      <Heart
        aria-hidden="true"
        size={18}
        strokeWidth={1.5}
        className={cx(
          'transition-colors duration-base ease-out',
          isWishlisted ? 'fill-gold text-gold-dark' : 'fill-transparent text-pearl group-hover/wishlist:text-gold-dark',
        )}
      />
    </button>
  );
}
