import type { QueryFilter, SortOrder } from 'mongoose';
import type { PartialWithUndefined } from '../../shared/types.js';
import { DiscountModel } from './discount.model.js';
import type { DiscountDoc, DiscountHydratedDoc } from './discount.model.js';

/** The ONLY file allowed to touch `DiscountModel` (plan.md §5.4). */

/** A loose mirror of `DiscountBuyXGetYSubdoc`, matching what `pricing.dto
 *  .ts`'s Zod schema actually parses (`appliesToCollectionId` as a plain id
 *  string) rather than the Mongoose subdocument's `Types.ObjectId` — same
 *  "normalize at the repository boundary" pattern as `product.repository
 *  .ts`'s `LooseProductSeo`. */
export interface LooseDiscountBuyXGetY {
  buyQty: number;
  getQty: number;
  appliesToCollectionId: string | null;
  discountPercent: number;
}

/** `usedCount` is deliberately absent — it's a server-owned counter
 *  (`incrementUsedCount` below is its only writer), never something an
 *  admin `PATCH` payload sets directly. */
export interface LooseDiscountUsage {
  limitTotal: number | null;
  limitPerCustomer: number | null;
}

export type CreateDiscountInput = Pick<DiscountDoc, 'name' | 'mode' | 'type'> &
  Partial<Omit<DiscountDoc, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'name' | 'mode' | 'type' | 'targetIds' | 'excludeIds' | 'buyXGetY' | 'usage'>> &
  Partial<{ targetIds: string[]; excludeIds: string[]; buyXGetY: LooseDiscountBuyXGetY | null; usage: LooseDiscountUsage }>;

export type UpdateDiscountInput = PartialWithUndefined<Omit<CreateDiscountInput, 'mode'>>;

const NOT_DELETED = { deletedAt: null };

export async function createDiscount(input: CreateDiscountInput): Promise<DiscountHydratedDoc> {
  // Same "Mongoose's own overload resolution can't express this under
  // exactOptionalPropertyTypes" cast class as `product.repository.ts`.
  return DiscountModel.create(input as unknown as Parameters<typeof DiscountModel.create>[0]);
}

export async function findDiscountById(id: string): Promise<DiscountHydratedDoc | null> {
  return DiscountModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function findDiscountByCode(code: string): Promise<DiscountHydratedDoc | null> {
  return DiscountModel.findOne({ code: code.toUpperCase(), ...NOT_DELETED }).exec();
}

/** Every candidate `applyDiscounts()` needs (plan.md §8.3 step 1): active
 *  automatic discounts, plus (if `code` is given) whatever discount that
 *  code resolves to regardless of its own status — see `discount-
 *  engine.ts`'s doc comment on why the inactive/expired match still needs
 *  to be included, not omitted. */
export async function findCandidateDiscounts(code: string | undefined): Promise<DiscountHydratedDoc[]> {
  const query: QueryFilter<DiscountDoc> = {
    ...NOT_DELETED,
    $or: [
      { mode: 'automatic', status: 'active' },
      ...(code ? [{ mode: 'code' as const, code: code.toUpperCase() }] : []),
    ],
  };
  return DiscountModel.find(query).exec();
}

export interface DiscountListFilter {
  status?: DiscountDoc['status'] | undefined;
  mode?: DiscountDoc['mode'] | undefined;
  search?: string | undefined;
}

const SORT_SPEC: Record<string, SortOrder> = { priority: 1, createdAt: -1 };

export async function listDiscounts(filter: DiscountListFilter, page: number, limit: number): Promise<{ discounts: DiscountHydratedDoc[]; total: number }> {
  const query: QueryFilter<DiscountDoc> = { ...NOT_DELETED };
  if (filter.status) query.status = filter.status;
  if (filter.mode) query.mode = filter.mode;
  if (filter.search) query.$or = [{ name: { $regex: filter.search, $options: 'i' } }, { code: { $regex: filter.search, $options: 'i' } }];

  const [discounts, total] = await Promise.all([
    DiscountModel.find(query)
      .sort(SORT_SPEC)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    DiscountModel.countDocuments(query).exec(),
  ]);
  return { discounts, total };
}

export async function updateDiscount(id: string, input: UpdateDiscountInput): Promise<DiscountHydratedDoc | null> {
  // `usage` is handled as targeted dot-paths, never a whole-subdocument
  // `$set` — replacing the whole `usage` object would run it back through
  // `discountUsageSchema`'s own field defaults for whatever the admin
  // payload didn't include, silently resetting a real `usedCount` back to
  // 0 the moment someone only meant to change `limitTotal`.
  const { usage, ...rest } = input;
  const update: Record<string, unknown> = { ...rest };
  if (usage) {
    if (usage.limitTotal !== undefined) update['usage.limitTotal'] = usage.limitTotal;
    if (usage.limitPerCustomer !== undefined) update['usage.limitPerCustomer'] = usage.limitPerCustomer;
  }
  return DiscountModel.findOneAndUpdate({ _id: id, ...NOT_DELETED }, update as unknown as Parameters<typeof DiscountModel.findOneAndUpdate>[1], { returnDocument: 'after' }).exec();
}

export async function softDeleteDiscount(id: string): Promise<boolean> {
  const result = await DiscountModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date(), status: 'disabled' }).exec();
  return result.modifiedCount > 0;
}

export async function toggleDiscountStatus(id: string, status: DiscountDoc['status']): Promise<DiscountHydratedDoc | null> {
  return DiscountModel.findOneAndUpdate({ _id: id, ...NOT_DELETED }, { status }, { returnDocument: 'after' }).exec();
}

/** Atomic increment — the `order` module's intended call site at order
 *  placement (plan.md §8.3: usage limits are "checked in Redis then
 *  Mongo"; this is Mongo's authoritative counter). Not called by anything
 *  in this phase — declared now so that module has nothing left to build
 *  on the `pricing` side. */
export async function incrementUsedCount(id: string): Promise<void> {
  await DiscountModel.updateOne({ _id: id }, { $inc: { 'usage.usedCount': 1 } }).exec();
}

/** The mirror of `incrementUsedCount` — `order` module's cancellation
 *  side-effect (plan.md §8.7.3: "on → cancelled ... decrement discount
 *  usage"). An aggregation-pipeline update so the floor at 0 is atomic
 *  (never a read-then-write race), same clamp pattern as `product
 *  .repository.ts#applyStockDelta`. */
export async function decrementUsedCount(id: string): Promise<void> {
  await DiscountModel.updateOne(
    { _id: id },
    [{ $set: { 'usage.usedCount': { $max: [0, { $subtract: ['$usage.usedCount', 1] }] } } }],
    { updatePipeline: true },
  ).exec();
}
