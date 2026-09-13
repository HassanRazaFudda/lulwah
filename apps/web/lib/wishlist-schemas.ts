import { z } from 'zod';
import { Wishlist } from '@lulwah/contracts';

/**
 * Response-shape schema for the `engagement` module's wishlist endpoints
 * (`apps/api/src/modules/engagement/wishlist.dto.ts`) — every one of
 * `GET|POST /me/wishlist`, `DELETE /me/wishlist/:productId` and
 * `POST /me/wishlist/merge` returns this same `{ wishlist }` envelope
 * (`wishlist.controller.ts`), so one schema covers all four.
 */
export const WishlistResponse = z.object({ wishlist: Wishlist });
export type WishlistResponse = z.infer<typeof WishlistResponse>;
