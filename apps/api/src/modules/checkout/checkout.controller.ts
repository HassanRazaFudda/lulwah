import type { Request, Response } from 'express';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import type { ReservationStore } from '../cart/reservation-store.js';
import * as service from './checkout.service.js';
import type { IdempotencyStore } from './idempotency-store.js';
import { CreateCheckoutSessionInput, CreatePaymentIntentInput, PlaceOrderInput, SetCheckoutAddressInput, SetCheckoutShippingInput, VerifyCodOtpInput } from './checkout.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). A factory (not bare exports) — same reason `cart
 *  .controller.ts` is one: every route here needs a `ReservationStore`
 *  (real Redis in production, in-memory in tests), and `place` additionally
 *  needs an `IdempotencyStore`. */
export function createCheckoutController(deps: { reservationStore: ReservationStore; idempotencyStore: IdempotencyStore }) {
  const { reservationStore, idempotencyStore } = deps;

  function actorOf(req: Request): AuthenticatedUser | null {
    return req.user ?? null;
  }

  async function create(req: Request, res: Response): Promise<void> {
    const input = CreateCheckoutSessionInput.parse(req.body);
    const session = await service.createSession(reservationStore, actorOf(req), input);
    sendSuccess(res, session, undefined, 201);
  }

  async function get(req: Request, res: Response): Promise<void> {
    const session = await service.getSession(req.params.id as string, actorOf(req));
    sendSuccess(res, session);
  }

  async function setAddress(req: Request, res: Response): Promise<void> {
    const input = SetCheckoutAddressInput.parse(req.body);
    const session = await service.setAddress(actorOf(req), req.params.id as string, input);
    sendSuccess(res, session);
  }

  async function setShipping(req: Request, res: Response): Promise<void> {
    SetCheckoutShippingInput.parse(req.body ?? {});
    const session = await service.setShipping(actorOf(req), req.params.id as string);
    sendSuccess(res, session);
  }

  async function createPaymentIntent(req: Request, res: Response): Promise<void> {
    const input = CreatePaymentIntentInput.parse(req.body);
    const result = await service.createPaymentIntent(actorOf(req), req.params.id as string, input.method);
    sendSuccess(res, result, undefined, 201);
  }

  async function verifyCodOtp(req: Request, res: Response): Promise<void> {
    const input = VerifyCodOtpInput.parse(req.body);
    const session = await service.verifyCodOtp(input.sessionId, input.code);
    sendSuccess(res, session);
  }

  /** plan.md §9.5: "requires an `Idempotency-Key` header." Missing entirely
   *  is a client bug, not a retryable condition — rejected before the
   *  service even sees the request. */
  async function place(req: Request, res: Response): Promise<void> {
    const idempotencyKey = req.header('idempotency-key');
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new AppError('VALIDATION_FAILED', 400, { messageEn: 'An Idempotency-Key header is required to place an order.', field: 'Idempotency-Key' });
    }
    const input = PlaceOrderInput.parse(req.body ?? {});
    const { order, replayed } = await service.place(reservationStore, idempotencyStore, actorOf(req), req.params.id as string, idempotencyKey, input.customerNote);
    sendSuccess(res, { order }, undefined, replayed ? 200 : 201);
  }

  return { create, get, setAddress, setShipping, createPaymentIntent, verifyCodOtp, place };
}
