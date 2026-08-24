import type { InventoryItem, StockMovement } from '@lulwah/contracts';
import type { InventoryItemDoc, InventoryItemHydratedDoc } from './inventory-item.model.js';
import type { StockMovementDoc, StockMovementHydratedDoc } from './stock-movement.model.js';

export function toInventoryItemDto(doc: InventoryItemDoc | InventoryItemHydratedDoc): InventoryItem {
  return {
    id: doc._id.toString(),
    variantId: doc.variantId.toString(),
    productId: doc.productId.toString(),
    sku: doc.sku,
    onHand: doc.onHand,
    reserved: doc.reserved,
    available: doc.available,
    lowStockThreshold: doc.lowStockThreshold,
    allowBackorder: doc.allowBackorder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toStockMovementDto(doc: StockMovementDoc | StockMovementHydratedDoc): StockMovement {
  return {
    id: doc._id.toString(),
    variantId: doc.variantId.toString(),
    type: doc.type,
    quantity: doc.quantity,
    before: doc.before,
    after: doc.after,
    reason: doc.reason,
    performedBy: doc.performedBy.toString(),
    createdAt: doc.createdAt,
  };
}
