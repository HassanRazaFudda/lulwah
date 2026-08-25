import type { Request, Response } from 'express';
import { CART_COOKIE_NAME, CART_COOKIE_TTL_MS } from '../../config/constants.js';
import { env } from '../../shared/env.js';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as service from './cart.service.js';
import type { ReservationStore } from './reservation-store.js';
import { AddCartItemInput, ApplyCouponInput, UpdateCartItemInput } from './cart.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). A factory, not bare exports, because every mutation
 *  needs the `ReservationStore` (real Redis in production, in-memory in
 *  tests) — same dependency-injection shape `identity.routes.ts` already
 *  uses for `rateLimitStore`, just threaded one layer deeper since `cart`'s
 *  reservation logic lives in the service, not route-level middleware. */
export function createCartController(deps: { reservationStore: ReservationStore }) {
  const { reservationStore } = deps;

  function requireAuthedUser(req: Request): AuthenticatedUser {
    if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
    return req.user;
  }

  /** Not `httpOnly` — unlike the refresh-token cookie (plan.md §10.1), the
   *  cart id isn't a credential; the storefront cart drawer legitimately
   *  wants to read it client-side. `SameSite=Lax`/`Secure`/30-day TTL per
   *  plan.md §8.5. */
  function setCartCookie(res: Response, cartId: string): void {
    res.cookie(CART_COOKIE_NAME, cartId, {
      httpOnly: false,
      secure: env.COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: CART_COOKIE_TTL_MS,
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    });
  }

  function readCartCookie(req: Request): string | null {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[CART_COOKIE_NAME];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  async function create(req: Request, res: Response): Promise<void> {
    const locale = (req.body as { locale?: unknown } | undefined)?.locale === 'ar' ? 'ar' : 'en';
    const { cart, cartId } = await service.createOrGetCart({ existingCartId: readCartCookie(req), locale });
    setCartCookie(res, cartId);
    sendSuccess(res, cart, undefined, 201);
  }

  async function get(req: Request, res: Response): Promise<void> {
    const cartId = req.params.cartId as string;
    const cart = await service.getCart(cartId);
    setCartCookie(res, cartId);
    sendSuccess(res, cart);
  }

  async function addItem(req: Request, res: Response): Promise<void> {
    const cartId = req.params.cartId as string;
    const input = AddCartItemInput.parse(req.body);
    const cart = await service.addItem(reservationStore, cartId, input);
    setCartCookie(res, cartId);
    sendSuccess(res, cart, undefined, 201);
  }

  async function updateItem(req: Request, res: Response): Promise<void> {
    const cartId = req.params.cartId as string;
    const itemId = req.params.itemId as string;
    const input = UpdateCartItemInput.parse(req.body);
    const cart = await service.updateItemQuantity(reservationStore, cartId, itemId, input.quantity);
    sendSuccess(res, cart);
  }

  async function removeItem(req: Request, res: Response): Promise<void> {
    const cartId = req.params.cartId as string;
    const itemId = req.params.itemId as string;
    const cart = await service.removeItem(reservationStore, cartId, itemId);
    sendSuccess(res, cart);
  }

  async function applyCoupon(req: Request, res: Response): Promise<void> {
    const cartId = req.params.cartId as string;
    const input = ApplyCouponInput.parse(req.body);
    const cart = await service.applyCoupon(cartId, input.code);
    sendSuccess(res, cart);
  }

  async function removeCoupon(req: Request, res: Response): Promise<void> {
    const cartId = req.params.cartId as string;
    const cart = await service.removeCoupon(cartId);
    sendSuccess(res, cart);
  }

  /** `POST /cart/:cartId/merge` — auth required (plan.md §9.5: "after
   *  login"). `:cartId` in the path is the guest cart being merged away;
   *  the cookie is still consulted as a fallback for storefront clients
   *  that call this right after login without re-reading the path param
   *  from wherever they stashed it. */
  async function merge(req: Request, res: Response): Promise<void> {
    const actor = requireAuthedUser(req);
    const pathCartId = req.params.cartId as string | undefined;
    const guestCartId = pathCartId ?? readCartCookie(req);
    const { cart, cartId } = await service.mergeCartOnLogin(reservationStore, guestCartId, actor.id);
    setCartCookie(res, cartId);
    sendSuccess(res, cart);
  }

  return { create, get, addItem, updateItem, removeItem, applyCoupon, removeCoupon, merge };
}
