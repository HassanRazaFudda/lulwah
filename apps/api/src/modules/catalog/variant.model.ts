import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { Size } from '@lulwah/contracts';

/**
 * Mongoose schema for `variants` — plan.md §7.6. Stock is deliberately NOT
 * a field here — `inventory` (the sibling `InventoryItem` collection, owned
 * by the `inventory` module) is the single source of truth for
 * onHand/reserved/available.
 */

export interface VariantOptionsSubdoc {
  size: Size | null;
  color: string | null;
  pieceCount: 1 | 2 | 3 | null;
}

const variantOptionsSchema = new Schema<VariantOptionsSubdoc>(
  {
    size: { type: String, default: null },
    color: { type: String, default: null },
    pieceCount: { type: Number, enum: [1, 2, 3, null], default: null },
  },
  { _id: false },
);

export interface VariantDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  sku: string;
  barcode: string | null;
  options: VariantOptionsSubdoc;
  priceFils: number;
  compareAtPriceFils: number | null;
  costPriceFils: number | null;
  weightGrams: number;
  mediaIds: string[];
  isActive: boolean;
  sortOrder: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<VariantDoc>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true, uppercase: true, trim: true },
    barcode: { type: String, default: null },
    options: { type: variantOptionsSchema, default: () => ({ size: null, color: null, pieceCount: null }) },
    priceFils: { type: Number, required: true, min: 0 },
    compareAtPriceFils: { type: Number, default: null, min: 0 },
    costPriceFils: { type: Number, default: null, min: 0 },
    weightGrams: { type: Number, required: true, min: 1 },
    mediaIds: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'variants' },
);

variantSchema.index({ sku: 1 }, { unique: true });
variantSchema.index({ productId: 1, isActive: 1 });
variantSchema.index({ productId: 1, 'options.size': 1 });

export type VariantHydratedDoc = HydratedDocument<VariantDoc>;
export const VariantModel = model<VariantDoc>('Variant', variantSchema);
