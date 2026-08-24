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
