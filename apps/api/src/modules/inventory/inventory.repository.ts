import type { QueryFilter } from 'mongoose';
import { InventoryItemModel } from './inventory-item.model.js';
import type { InventoryItemDoc, InventoryItemHydratedDoc } from './inventory-item.model.js';
import { StockMovementModel } from './stock-movement.model.js';
import type { StockMovementHydratedDoc, StockMovementType } from './stock-movement.model.js';

/**
 * The ONLY file allowed to touch `InventoryItemModel`/`StockMovementModel`
 * (plan.md §5.4). `inventory.service.ts` decides *what* onHand/reserved
 * should become and which movement to write; this file only executes it.
 */

/** `variantId`/`productId` are plain id strings here (what
 *  `inventory.service.ts`'s callers actually have), not
 *  `InventoryItemDoc`'s Mongoose-native `Types.ObjectId` — see
 *  `catalog/brand.repository.ts`'s equivalent comment for why this is
 *  safe (Mongoose casts either shape identically at runtime). */
export type CreateInventoryItemInput = { variantId: string; productId: string; sku: string } & Partial<
  Pick<InventoryItemDoc, 'onHand' | 'lowStockThreshold' | 'allowBackorder'>
>;

export async function findInventoryItemByVariantId(variantId: string): Promise<InventoryItemHydratedDoc | null> {
  return InventoryItemModel.findOne({ variantId }).exec();
}

/** Upsert so re-running the seed script (or a retried admin request) never
 *  double-creates a row for the same variant. */
export async function upsertInventoryItem(input: CreateInventoryItemInput): Promise<InventoryItemHydratedDoc> {
  const onHand = input.onHand ?? 0;
  const doc = await InventoryItemModel.findOneAndUpdate(
    { variantId: input.variantId },
    {
      $setOnInsert: {
        variantId: input.variantId,
        productId: input.productId,
        sku: input.sku,
        onHand,
        reserved: 0,
        available: onHand,
        lowStockThreshold: input.lowStockThreshold ?? 3,
        allowBackorder: input.allowBackorder ?? false,
      },
    },
    { upsert: true, returnDocument: 'after' },
  ).exec();
  // findOneAndUpdate with upsert always returns a document (created or
  // matched) — the null case only exists at the type level.
  if (!doc) throw new Error('upsertInventoryItem: unexpected null result');
  return doc;
}

/**
 * The single place `onHand`/`available` change (plan.md §7.8: "Stock is
 * never set by a bare `$set`. Every change writes a movement."). Not
 * wrapped in a multi-document transaction — order placement's atomic
 * reservation flow is P2 scope (cart module); this phase's admin-only
 * adjustment path accepts the small race window between these two writes
 * as a deliberate simplification (see module report).
 */
export async function applyAdjustmentAndRecordMovement(params: {
  item: InventoryItemHydratedDoc;
  quantity: number;
  after: number;
  type: StockMovementType;
  reason: string;
  performedBy: string;
}): Promise<{ item: InventoryItemHydratedDoc; movement: StockMovementHydratedDoc }> {
  const { item, quantity, after, type, reason, performedBy } = params;
  const before = item.onHand;
  item.onHand = after;
  item.available = after - item.reserved;
  await item.save();
  const movement = await StockMovementModel.create({
    variantId: item.variantId,
    type,
    quantity,
    before,
    after,
    reason,
    performedBy,
  });
  return { item, movement };
}

export async function deleteInventoryItem(variantId: string): Promise<InventoryItemHydratedDoc | null> {
  return InventoryItemModel.findOneAndDelete({ variantId }).exec();
}

/**
 * `cart`'s reservation flow (plan.md §8.4) — same pairing rule as
 * `applyAdjustmentAndRecordMovement`: `reserved`/`available` never move
 * without a `StockMovement` row alongside them. Caller (`inventory.service
 * .ts#reserveStock`) has already verified `available >= quantity` (or
 * `allowBackorder`) while holding the cart module's per-variant Redis lock
 * — this function trusts that and just executes the write.
 */
export async function applyReservationAndRecordMovement(params: {
  item: InventoryItemHydratedDoc;
  quantity: number;
  reference: string;
  performedBy: string;
}): Promise<{ item: InventoryItemHydratedDoc; movement: StockMovementHydratedDoc }> {
  const { item, quantity, reference, performedBy } = params;
  const beforeAvailable = item.available;
  item.reserved += quantity;
  item.available = item.onHand - item.reserved;
  await item.save();
  const movement = await StockMovementModel.create({
    variantId: item.variantId,
    type: 'reservation',
    quantity: -quantity, // signed: a reservation reduces what's available for sale
    before: beforeAvailable,
    after: item.available,
    reason: `Reserved for cart ${reference}`,
    performedBy,
  });
  return { item, movement };
}

/**
 * Releases a previously-reserved quantity — either an explicit cart
 * mutation (item removed, quantity reduced) or the sweep job reclaiming a
 * lapsed reservation (plan.md §8.4). `reserved` is clamped at 0 (mirrors
 * `product.repository.ts#applyStockDelta`'s `$max: [0, ...]` clamp) so a
 * caller that (rarely, see `reservation-store.ts`'s doc comment on its one
 * accepted race window) attempts to release more than is actually reserved
 * can never push `available` above `onHand`.
 */
export async function applyReleaseAndRecordMovement(params: {
  item: InventoryItemHydratedDoc;
  quantity: number;
  reference: string;
  performedBy: string;
}): Promise<{ item: InventoryItemHydratedDoc; movement: StockMovementHydratedDoc }> {
  const { item, quantity, reference, performedBy } = params;
  const beforeAvailable = item.available;
  item.reserved = Math.max(0, item.reserved - quantity);
  item.available = item.onHand - item.reserved;
  await item.save();
  const movement = await StockMovementModel.create({
    variantId: item.variantId,
    type: 'release',
    quantity: item.available - beforeAvailable, // signed: a release increases what's available
    before: beforeAvailable,
    after: item.available,
    reason: `Released from cart ${reference}`,
    performedBy,
  });
  return { item, movement };
}

/**
 * `order` module's confirmation-side-effect call site (plan.md §8.4: "On
 * `order.placed`: reservation → sale movement, `onHand -= qty, reserved -=
 * qty`"). Tracks before/after on `onHand` (unlike `applyReservationAndRecordMovement`/
 * `applyReleaseAndRecordMovement`, which track `available`) — a sale is
 * fundamentally physical stock leaving the warehouse, and "where did N
 * pieces go" (this file's own §7.8 mandate) is best answered in `onHand`
 * terms for this movement type. `available` is unaffected by construction
 * (`onHand` and `reserved` both drop by the same amount), so — unlike
 * every other mutator in this file — this one does NOT call
 * `applyProductStockDelta`; the storefront-facing `available`/`totalStock`
 * were already decremented when the line was originally reserved.
 *
 * Both `onHand`/`reserved` are clamped at 0 rather than allowed to go
 * negative — the documented, accepted edge case (see `inventory.service
 * .ts#commitReservedSale`'s doc comment) where a checkout's extended
 * reservation genuinely lapsed (sweep job reclaimed it) in the narrow
 * window before a slow webhook confirmed payment. `quantity` on the
 * recorded movement reflects the *actual* clamped decrease, not the
 * nominal request, so the audit trail is never a lie even in that case.
 */
export async function applySaleAndRecordMovement(params: {
  item: InventoryItemHydratedDoc;
  quantity: number;
  reference: string;
  performedBy: string;
}): Promise<{ item: InventoryItemHydratedDoc; movement: StockMovementHydratedDoc }> {
  const { item, quantity, reference, performedBy } = params;
  const beforeOnHand = item.onHand;
  item.onHand = Math.max(0, item.onHand - quantity);
  item.reserved = Math.max(0, item.reserved - quantity);
  item.available = item.onHand - item.reserved;
  await item.save();
  const actualDecrease = beforeOnHand - item.onHand;
  const movement = await StockMovementModel.create({
    variantId: item.variantId,
    type: 'sale',
    quantity: -actualDecrease, // signed: stock leaving onHand
    before: beforeOnHand,
    after: item.onHand,
    reason: `Sold — order ${reference}`,
    performedBy,
  });
  return { item, movement };
}

/**
 * The mirror of `applySaleAndRecordMovement` — `order` module's
 * cancellation side-effect when a sale was already committed (an order
 * cancelled from `confirmed` or later, per `order.transitions.ts`; a
 * cancellation still in `pending_payment` never committed a sale in the
 * first place and uses the plain `releaseStock` reservation path instead).
 * Recorded as `adjustment`, not `return` — an RMA-style `return` implies
 * the goods physically left and came back inspected; this is a sale that
 * never shipped being reversed, an out-of-band correction to `onHand`, not
 * a customer return.
 */
export async function applyCancellationRestockAndRecordMovement(params: {
  item: InventoryItemHydratedDoc;
  quantity: number;
  reference: string;
  performedBy: string;
}): Promise<{ item: InventoryItemHydratedDoc; movement: StockMovementHydratedDoc; deltaAvailable: number }> {
  const { item, quantity, reference, performedBy } = params;
  const beforeOnHand = item.onHand;
  const beforeAvailable = item.available;
  item.onHand = item.onHand + quantity;
  item.available = item.onHand - item.reserved;
  await item.save();
  const movement = await StockMovementModel.create({
    variantId: item.variantId,
    type: 'adjustment',
    quantity,
    before: beforeOnHand,
    after: item.onHand,
    reason: `Order ${reference} cancelled after confirmation — stock restored`,
    performedBy,
  });
  return { item, movement, deltaAvailable: item.available - beforeAvailable };
}

export interface InventoryListFilter {
  // `| undefined` explicitly, not just `?:` — callers pass an already
  // Zod-parsed query object straight through (`inventory.controller.ts`),
  // and `exactOptionalPropertyTypes` (plan.md §27.1) treats "key present
  // with value `undefined`" as a distinct case from "key omitted".
  lowStock?: boolean | undefined;
  outOfStock?: boolean | undefined;
  search?: string | undefined; // matches sku (denormalised on the item — see model doc comment)
}

export async function listInventory(
  filter: InventoryListFilter,
  page: number,
  limit: number,
): Promise<{ items: InventoryItemHydratedDoc[]; total: number }> {
  const query: QueryFilter<InventoryItemDoc> = {};
  if (filter.outOfStock) query.available = { $lte: 0 };
  else if (filter.lowStock) query.$expr = { $and: [{ $lte: ['$available', '$lowStockThreshold'] }, { $gt: ['$available', 0] }] };
  if (filter.search) query.sku = { $regex: filter.search.trim(), $options: 'i' };

  const [items, total] = await Promise.all([
    InventoryItemModel.find(query)
      .sort({ available: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    InventoryItemModel.countDocuments(query).exec(),
  ]);
  return { items, total };
}

export async function listMovementsForVariant(variantId: string, page: number, limit: number): Promise<{ movements: StockMovementHydratedDoc[]; total: number }> {
  const query = { variantId };
  const [movements, total] = await Promise.all([
    StockMovementModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    StockMovementModel.countDocuments(query).exec(),
  ]);
  return { movements, total };
}

export async function findInventoryItemsByVariantIds(variantIds: readonly string[]): Promise<InventoryItemHydratedDoc[]> {
  return InventoryItemModel.find({ variantId: { $in: variantIds } }).exec();
}
