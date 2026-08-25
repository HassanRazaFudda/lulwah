import type { Discount } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './discount.repository.js';
import type { DiscountListFilter } from './discount.repository.js';
import { toDiscountDto } from './discount.mapper.js';
import { applyDiscounts } from './discount-engine.js';
import type { ApplyDiscountsResult, CartLineSnapshot, DiscountEligibilityContext } from './discount-engine.js';
import type { AdminCreateDiscountInput, AdminUpdateDiscountInput } from './pricing.dto.js';

/**
 * ALL discount business rules live here, framework-free (no `express`).
 * `discount-engine.ts`'s `applyDiscounts()` is the pure maths; this file is
 * the impure wrapper around it (plan.md §8.3: "Load all active discounts
 * within their date window" — the Mongo query — plus admin CRUD).
 *
 * **Usage-limit checking — a documented scope trim.** Plan.md §8.3 says
 * usage limits are "checked in Redis then Mongo" (a fast-path optimization
 * for a hot, high-contention counter). This phase checks Mongo's
 * `usage.usedCount` only — the counter nothing increments yet, since only
 * an actual order placement should consume it (a cart merely *applying* a
 * coupon must not burn a redemption; an abandoned cart doesn't get to keep
 * one), and the `order` module that would call `incrementUsedCount` isn't
 * built in this phase. The engine itself (`discount-engine.ts`) is fully
 * spec-complete either way — it takes `usedCount`/`perCustomerUsage` as
 * plain inputs and enforces the limits correctly against whatever it's
 * given; wiring a Redis fast-path in front of the same Mongo read is a
 * pure performance optimization for later, not a correctness gap today.
 */

function isDuplicateCodeError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

export async function adminListDiscounts(actor: AuthenticatedUser, filter: DiscountListFilter, page: number, limit: number): Promise<{ discounts: Discount[]; total: number }> {
  assertPermission(actor, 'discounts.read');
  const { discounts, total } = await repo.listDiscounts(filter, page, limit);
  return { discounts: discounts.map(toDiscountDto), total };
}

export async function adminGetDiscount(actor: AuthenticatedUser, id: string): Promise<Discount> {
  assertPermission(actor, 'discounts.read');
  const doc = await repo.findDiscountById(id);
  if (!doc) throw notFoundError('Discount not found.');
  return toDiscountDto(doc);
}

export async function createDiscount(actor: AuthenticatedUser, input: AdminCreateDiscountInput): Promise<Discount> {
  assertPermission(actor, 'discounts.write');
  if (input.mode === 'code' && !input.code) {
    throw new AppError('VALIDATION_FAILED', 400, { messageEn: 'A code-mode discount requires a code.', field: 'code' });
  }
  try {
    const doc = await repo.createDiscount({ ...input, code: input.code ? input.code.toUpperCase() : null });
    return toDiscountDto(doc);
  } catch (err) {
    if (isDuplicateCodeError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A discount with this code already exists.', field: 'code' });
    throw err;
  }
}

export async function updateDiscount(actor: AuthenticatedUser, id: string, input: AdminUpdateDiscountInput): Promise<Discount> {
  assertPermission(actor, 'discounts.write');
  try {
    const updated = await repo.updateDiscount(id, { ...input, ...(input.code !== undefined ? { code: input.code ? input.code.toUpperCase() : null } : {}) });
    if (!updated) throw notFoundError('Discount not found.');
    return toDiscountDto(updated);
  } catch (err) {
    if (isDuplicateCodeError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A discount with this code already exists.', field: 'code' });
    throw err;
  }
}

export async function deleteDiscount(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'discounts.write');
  const deleted = await repo.softDeleteDiscount(id);
  if (!deleted) throw notFoundError('Discount not found.');
}

/** `POST /admin/discounts/:id/toggle` — plan.md §9.7. Flips between
 *  `active`/`disabled` only; a `draft`/`scheduled` discount is turned on
 *  via its own status field in a full update, not this shortcut. */
export async function toggleDiscount(actor: AuthenticatedUser, id: string): Promise<Discount> {
  assertPermission(actor, 'discounts.write');
  const existing = await repo.findDiscountById(id);
  if (!existing) throw notFoundError('Discount not found.');
  const nextStatus = existing.status === 'active' ? 'disabled' : 'active';
  const updated = await repo.toggleDiscountStatus(id, nextStatus);
  if (!updated) throw notFoundError('Discount not found.');
  return toDiscountDto(updated);
}

// ---------------------------------------------------------------------------
// Cross-module entry point — `cart`'s exclusive way into `pricing`
// (plan.md §5.3): never `DiscountModel` directly, only this function.
// ---------------------------------------------------------------------------

export interface ComputeCartDiscountsInput {
  lines: CartLineSnapshot[];
  subtotalFils: number;
  /** The single applied coupon code, if any (plan.md §8.3: one per order). */
  couponCode: string | null;
  isFirstOrder: boolean;
  customerTags: readonly string[];
  /** Unresolved at cart phase — see `discount-engine.ts`'s
   *  `DiscountEligibilityContext` doc comment. */
  paymentMethod: string | null;
  emirate: string | null;
  currentShippingFils: number;
}

export async function computeCartDiscounts(input: ComputeCartDiscountsInput): Promise<ApplyDiscountsResult> {
  const candidateDocs = await repo.findCandidateDiscounts(input.couponCode ?? undefined);
  const discounts = candidateDocs.map(toDiscountDto);

  const ctx: DiscountEligibilityContext = {
    now: new Date(),
    isFirstOrder: input.isFirstOrder,
    customerTags: input.customerTags,
    paymentMethod: input.paymentMethod,
    emirate: input.emirate,
    currentShippingFils: input.currentShippingFils,
    perCustomerUsage: {}, // see this file's doc comment
  };

  return applyDiscounts({ lines: input.lines, subtotalFils: input.subtotalFils, couponCodes: input.couponCode ? [input.couponCode] : [] }, discounts, ctx);
}
