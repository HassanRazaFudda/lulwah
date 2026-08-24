import type { AdjustStockInput, InventoryItem, StockMovement } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './inventory.repository.js';
import type { InventoryListFilter } from './inventory.repository.js';
import { toInventoryItemDto, toStockMovementDto } from './inventory.mapper.js';
import { inventoryEvents } from './inventory.events.js';
// Write-only cross-module call through `catalog`'s exported service
// interface, per plan.md §5.3 — never its repository or model directly.
// This is `applyProductStockDelta`'s intended (and only) caller.
import { applyProductStockDelta } from '../catalog/product.service.js';

/**
 * ALL inventory business rules live here, framework-free (plan.md §5.4).
 * The one rule this whole module exists to enforce: `InventoryItem.onHand`
 * never changes without a `StockMovement` row alongside it (plan.md §7.8).
 * See `inventory.repository.ts#applyAdjustmentAndRecordMovement` for the
 * one place that pairing happens, and its doc comment for the deliberate
 * non-transactional simplification in this phase.
 */

export interface EnsureInventoryItemParams {
  variantId: string;
  productId: string;
  sku: string;
  onHand: number;
  performedBy?: string;
}

/** Called by `catalog`'s `variant.service.ts` right after a variant is
 *  created — every variant must have exactly one `InventoryItem` row
 *  (plan.md §7.7's "single source of truth"). Idempotent: re-running the
 *  seed script or retrying a request never double-creates a row or
 *  double-counts the initial stock into `Product.totalStock`. */
export async function ensureInventoryItem(params: EnsureInventoryItemParams): Promise<InventoryItem> {
  const existing = await repo.findInventoryItemByVariantId(params.variantId);
  if (existing) return toInventoryItemDto(existing);

  const item = await repo.upsertInventoryItem({
    variantId: params.variantId,
    productId: params.productId,
    sku: params.sku,
    onHand: params.onHand,
  });

  if (params.onHand > 0) {
    await applyProductStockDelta(params.productId, params.onHand);
  }
  return toInventoryItemDto(item);
}

export async function getInventoryForVariants(variantIds: readonly string[]): Promise<InventoryItem[]> {
  if (variantIds.length === 0) return [];
  const items = await repo.findInventoryItemsByVariantIds(variantIds);
  return items.map(toInventoryItemDto);
}

/** plan.md §9.7 `POST /admin/inventory/:variantId/adjust` — the only write
 *  path onto `onHand` in this phase. Reason is mandatory (enforced by
 *  `@lulwah/contracts`' `AdjustStockInput` at the controller). */
export async function adjustStock(actor: AuthenticatedUser, variantId: string, input: AdjustStockInput): Promise<{ item: InventoryItem; movement: StockMovement }> {
  assertPermission(actor, 'inventory.write');
  const item = await repo.findInventoryItemByVariantId(variantId);
  if (!item) throw notFoundError('Inventory record not found for this variant.');

  const after = item.onHand + input.quantity;
  if (after < 0) {
    throw new AppError('INSUFFICIENT_STOCK', 409, {
      messageEn: `This adjustment would take on-hand stock below zero (currently ${item.onHand}).`,
      details: { onHand: item.onHand, quantity: input.quantity },
    });
  }

  const beforeAvailable = item.available;
  const { item: updated, movement } = await repo.applyAdjustmentAndRecordMovement({
    item,
    quantity: input.quantity,
    after,
    type: input.type,
    reason: input.reason,
    performedBy: actor.id,
  });

  const deltaAvailable = updated.available - beforeAvailable;
  if (deltaAvailable !== 0) await applyProductStockDelta(updated.productId.toString(), deltaAvailable);
  emitStockEvents(updated.variantId.toString(), updated.productId.toString(), beforeAvailable, updated.available, updated.lowStockThreshold);

  return { item: toInventoryItemDto(updated), movement: toStockMovementDto(movement) };
}

/** Called by `catalog`'s `variant.service.ts` when a variant is deleted —
 *  removes its `InventoryItem` and folds its stock back out of the parent
 *  product's `totalStock` before the row disappears. */
export async function deleteInventoryItem(variantId: string): Promise<void> {
  const item = await repo.findInventoryItemByVariantId(variantId);
  if (!item) return;
  if (item.available !== 0) await applyProductStockDelta(item.productId.toString(), -item.available);
  await repo.deleteInventoryItem(variantId);
}

export async function adminListInventory(
  actor: AuthenticatedUser,
  filter: InventoryListFilter,
  page: number,
  limit: number,
): Promise<{ items: InventoryItem[]; total: number }> {
  assertPermission(actor, 'inventory.read');
  const { items, total } = await repo.listInventory(filter, page, limit);
  return { items: items.map(toInventoryItemDto), total };
}

export async function adminListMovements(actor: AuthenticatedUser, variantId: string, page: number, limit: number): Promise<{ movements: StockMovement[]; total: number }> {
  assertPermission(actor, 'inventory.read');
  const { movements, total } = await repo.listMovementsForVariant(variantId, page, limit);
  return { movements: movements.map(toStockMovementDto), total };
}

function emitStockEvents(variantId: string, productId: string, before: number, after: number, lowStockThreshold: number): void {
  if (after <= 0 && before > 0) {
    inventoryEvents.publish('stock.out', { variantId, productId });
  } else if (after <= lowStockThreshold && before > lowStockThreshold) {
    inventoryEvents.publish('stock.low', { variantId, productId, available: after, lowStockThreshold });
  } else if (after > lowStockThreshold && before <= lowStockThreshold) {
    inventoryEvents.publish('stock.restocked', { variantId, productId, available: after });
  }
}
