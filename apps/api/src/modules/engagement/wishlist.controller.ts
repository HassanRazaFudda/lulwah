import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { WISHLIST_GUEST_COOKIE_NAME, WISHLIST_GUEST_COOKIE_TTL_MS } from '../../config/constants.js';
import { env } from '../../shared/env.js';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './engagement.controller-utils.js';
import * as service from './wishlist.service.js';
import type { WishlistIdentity } from './wishlist.service.js';
import { AddWishlistItemInput } from './wishlist.dto.js';

/** Parse+validate (Zod) → resolve guest/logged-in identity → call service
 *  → shape response. No business logic (plan.md §5.4). */

/** Not `httpOnly` — same reasoning as `cart.controller.ts#setCartCookie`:
 *  a wishlist icon legitimately wants to read this client-side, and it
 *  isn't a credential. */
function setGuestCookie(res: Response, guestId: string): void {
  res.cookie(WISHLIST_GUEST_COOKIE_NAME, guestId, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: WISHLIST_GUEST_COOKIE_TTL_MS,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

function readGuestCookie(req: Request): string | null {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[WISHLIST_GUEST_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * `GET|POST /me/wishlist`, `DELETE /me/wishlist/:productId` — plan.md §9.4:
 * authenticated OR guest, the same identity split `cart`'s routes support.
 * A logged-in request always resolves to `{ userId, guestId: null }`
 * (`req.user` wins even if a stale guest cookie is also present — once
 * signed in, a shopper's wishlist is their account's, not whatever
 * anonymous cookie their browser happened to be carrying); an anonymous
 * request resolves to `{ userId: null, guestId }`, minting a fresh
 * `guestId` (and (re)setting the cookie, refreshing its TTL) if none was
 * presented yet — always called, mirroring `cart.controller.ts#create`'s
 * "always (re)set the cart cookie" posture.
 */
function resolveIdentity(req: Request, res: Response): WishlistIdentity {
  if (req.user) return { userId: req.user.id, guestId: null };
  const guestId = readGuestCookie(req) ?? randomUUID();
  setGuestCookie(res, guestId);
  return { userId: null, guestId };
}

export async function getMy(req: Request, res: Response): Promise<void> {
  const identity = resolveIdentity(req, res);
  const wishlist = await service.getMyWishlist(identity);
  sendSuccess(res, { wishlist });
}

export async function addItem(req: Request, res: Response): Promise<void> {
  const identity = resolveIdentity(req, res);
  const input = AddWishlistItemInput.parse(req.body);
  const wishlist = await service.addItemToWishlist(identity, input);
  sendSuccess(res, { wishlist }, undefined, 201);
}

export async function removeItem(req: Request, res: Response): Promise<void> {
  const identity = resolveIdentity(req, res);
  const productId = objectId.parse(req.params.productId);
  const wishlist = await service.removeItemFromWishlist(identity, productId);
  sendSuccess(res, { wishlist });
}

/** `POST /me/wishlist/merge` — auth required (mirrors
 *  `cart.controller.ts#merge`'s own `requireAuthedUser` + guest-cookie-read
 *  shape exactly). The guest cookie is cleared afterward, not re-set to
 *  anything: unlike a cart, a `Wishlist` has no externally-held id for the
 *  cookie to carry once merged — the caller's own login is what finds it
 *  from here on. */
export async function merge(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const guestId = readGuestCookie(req);
  const wishlist = await service.mergeWishlistOnLogin(guestId, actor.id);
  res.clearCookie(WISHLIST_GUEST_COOKIE_NAME, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
  sendSuccess(res, { wishlist });
}

/** `GET /admin/customers/:id/wishlist` — plan.md §11.1's Customer detail
 *  screen. `wishlist: null` (not a 404) when the customer has no wishlist
 *  yet — the ordinary state for most customers, mirroring
 *  `cart.service.ts#getActiveCartForUser`'s identical "no cart yet" posture
 *  the `/admin/customers/:id` endpoint already relies on. */
export async function adminGetForCustomer(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const customerId = objectId.parse(req.params.id);
  const wishlist = await service.adminGetWishlistForCustomer(actor, customerId);
  sendSuccess(res, { wishlist });
}
