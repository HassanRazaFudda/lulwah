import { z } from 'zod';
import { objectId } from './common.js';

/**
 * InventoryItem — plan.md §7.7, scoped to this phase's on-hand tracking
 * only. `incoming`/`incomingEta`/`warehouseId`/`binLocation`/`lastCountedAt`
 * from the full plan shape are left out per the brief's explicit scope note
 * ("Scope for THIS phase only: on-hand stock tracking and the audit trail")
 * — add them back alongside a real warehouse/PO workflow later.
 */
export const InventoryItem = z.object({
  id: objectId,
  variantId: objectId,
  productId: objectId,
  sku: z.string(),
  onHand: z.number().int(),
  reserved: z.number().int().nonnegative(), // unused until `cart` exists (P2) — always 0 today
  available: z.number().int(), // computed = onHand - reserved, stored + indexed
  lowStockThreshold: z.number().int().nonnegative(),
  allowBackorder: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type InventoryItem = z.infer<typeof InventoryItem>;

/**
 * StockMovement — plan.md §7.8, append-only audit trail. Scoped to this
 * phase's manual/warehouse movement types only; `reservation`/`release`/
 * `sale` belong to the cart/checkout reservation flow (§8.4), which is P2
 * scope, not built here.
 */
export const StockMovementType = z.enum(['purchase', 'adjustment', 'return', 'damage', 'transfer']);
export type StockMovementType = z.infer<typeof StockMovementType>;

export const StockMovement = z.object({
  id: objectId,
  variantId: objectId,
  type: StockMovementType,
  quantity: z.number().int(), // signed
  before: z.number().int(),
  after: z.number().int(),
  reason: z.string(),
  performedBy: objectId,
  createdAt: z.coerce.date(),
});
export type StockMovement = z.infer<typeof StockMovement>;

/** `POST /admin/inventory/:variantId/adjust` — plan.md §9.7. Reason is
 *  mandatory: every stock change must be auditable ("where did 4 pieces go
 *  six months later" — §7.8). */
export const AdjustStockInput = z.object({
  quantity: z.number().int().refine((v) => v !== 0, 'quantity must be non-zero'),
  type: StockMovementType,
  reason: z.string().min(1, 'A reason is required for every stock adjustment.'),
});
export type AdjustStockInput = z.infer<typeof AdjustStockInput>;
