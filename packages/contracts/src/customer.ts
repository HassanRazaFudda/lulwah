import { z } from 'zod';
import { User } from './user.js';

/**
 * Customer — plan.md §11.1's admin "Customers" screen. A customer IS a
 * `User` with `role: 'customer'` (plan.md §7.1) — there is no separate
 * `customers` collection. This file adds only the genuinely new,
 * admin-only shapes `user.ts` deliberately doesn't carry (see that file's
 * own doc comment on why `notesInternal` is excluded from the shared
 * `User` contract) plus the one new domain concept this screen introduces
 * (a COD risk signal).
 */

/**
 * The admin-only superset of `User` — same "public entity + admin-only
 * extension lives alongside its consuming surface" pattern
 * `AdminVariantWithStock` (`apps/api/src/modules/catalog/product.dto.ts`)
 * already establishes for `Variant`. `notesInternal` (plan.md §7.1:
 * "staff-only") must never reach a storefront client — this type exists
 * specifically so it can round-trip through the admin-only
 * `/admin/customers*` surface without adding it to the shared `User`
 * schema every other consumer (including the storefront's own `/auth/me`)
 * also uses.
 */
export const AdminCustomerProfile = User.extend({
  notesInternal: z.string(),
});
export type AdminCustomerProfile = z.infer<typeof AdminCustomerProfile>;

/**
 * plan.md §11.1 "COD risk flags" / §19's Fraud (COD) row / §29 risk #6:
 * "risk score from order value, address completeness, phone verification,
 * prior COD refusals." No scoring model or fraud-detection pipeline exists
 * anywhere in this codebase (checked `payment/cod.gateway.ts` and the rest
 * of the `payment` module — nothing computes risk there or anywhere else).
 * Rather than fabricate one, this is a transparent, real-data-derived
 * signal only: whether staff have applied the `risky_cod` tag already
 * reserved in plan.md §7.1's own tag vocabulary, plus a live count of this
 * customer's actual COD order history. A real scoring model (order value,
 * address completeness, phone verification, a blocklist) is future work,
 * not built here — see the `customer` module's own report.
 */
export const CustomerCodRisk = z.object({
  taggedRisky: z.boolean(),
  codOrdersPlaced: z.number().int().nonnegative(),
  codOrdersCancelled: z.number().int().nonnegative(),
  cancelledRate: z.number().min(0).max(1),
});
export type CustomerCodRisk = z.infer<typeof CustomerCodRisk>;

/**
 * `PATCH /admin/customers/:id` — plan.md §11.1's tag editor + internal
 * notes panel. Each field replaces its current value wholesale when
 * present (the client sends the whole desired tag list / note text, not a
 * delta): `tags` is a flat replace, and `notesInternal` mirrors its
 * schema shape (plan.md §7.1: a single free-text field, NOT an
 * append-only log like `Order.internalNotes[]` — a deliberately different
 * shape from that similarly-named order field). Both optional and
 * independent: a request may update just one.
 */
export const UpdateCustomerInput = z.object({
  tags: z.array(z.string()).optional(),
  notesInternal: z.string().max(5000).optional(),
});
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInput>;
