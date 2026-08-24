import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `inventory` — plan.md §7.7, scoped to this phase's
 * on-hand tracking only (see `@lulwah/contracts`' `inventory.ts` doc
 * comment for the fields deliberately left out). `available` is stored and
 * indexed rather than computed at read time, so `?lowStock`/`?outOfStock`
 * admin filters and the low-stock threshold comparison stay index-backed.
 *
 * `productId`/`sku` are denormalised from the owning `Variant`/`Product`
 * (catalog-owned) at creation time — `inventory` may not import catalog's
 * models (plan.md §5.3), so carrying these copies here is what lets the
 * admin inventory list filter/search without a cross-module join.
 */
export interface InventoryItemDoc {
  _id: Types.ObjectId;
  variantId: Types.ObjectId;
  productId: Types.ObjectId;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryItemSchema = new Schema<InventoryItemDoc>(
  {
    variantId: { type: Schema.Types.ObjectId, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, uppercase: true, trim: true },
    onHand: { type: Number, required: true, default: 0 },
    reserved: { type: Number, required: true, default: 0, min: 0 },
    available: { type: Number, required: true, default: 0 },
    lowStockThreshold: { type: Number, required: true, default: 3 },
    allowBackorder: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'inventory' },
);

// plan.md §7.14: { variantId:1 } unique, { available:1 }, { available:1, lowStockThreshold:1 }
inventoryItemSchema.index({ variantId: 1 }, { unique: true });
inventoryItemSchema.index({ available: 1 });
inventoryItemSchema.index({ available: 1, lowStockThreshold: 1 });
inventoryItemSchema.index({ sku: 1 });
inventoryItemSchema.index({ productId: 1 });

export type InventoryItemHydratedDoc = HydratedDocument<InventoryItemDoc>;
export const InventoryItemModel = model<InventoryItemDoc>('InventoryItem', inventoryItemSchema);
