import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `stock_movements` — plan.md §7.8, append-only.
 * "Stock is never set by a bare `$set`. Every change writes a movement.
 * This is how we answer 'where did 4 pieces go?' six months later." — no
 * repository function in this module ever updates `InventoryItem.onHand`
 * without also inserting one of these (see `inventory.repository.ts`).
 *
 * `reservation`/`release`/`sale` from the full plan enum belong to the
 * cart/checkout reservation flow (§8.4) — P2 scope, not built here (see
 * `@lulwah/contracts`' `inventory.ts` doc comment).
 */
export type StockMovementType = 'purchase' | 'adjustment' | 'return' | 'damage' | 'transfer';

export interface StockMovementDoc {
  _id: Types.ObjectId;
  variantId: Types.ObjectId;
  type: StockMovementType;
  quantity: number; // signed
  before: number;
  after: number;
  reason: string;
  performedBy: Types.ObjectId;
  createdAt: Date;
}

const stockMovementSchema = new Schema<StockMovementDoc>(
  {
    variantId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['purchase', 'adjustment', 'return', 'damage', 'transfer'], required: true },
    quantity: { type: Number, required: true },
    before: { type: Number, required: true },
    after: { type: Number, required: true },
    reason: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, required: true },
  },
  // No `updatedAt` — this collection is append-only, rows are never edited.
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'stock_movements' },
);

stockMovementSchema.index({ variantId: 1, createdAt: -1 });

export type StockMovementHydratedDoc = HydratedDocument<StockMovementDoc>;
export const StockMovementModel = model<StockMovementDoc>('StockMovement', stockMovementSchema);
