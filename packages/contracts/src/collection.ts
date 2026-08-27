import { z } from 'zod';
import { objectId } from './common.js';
import { MediaRef } from './product.js';

/**
 * Collection — plan.md §7.9. Phase P3 (plan.md §11.1's Content screen row —
 * "manual ordering by drag, or rule builder for automated collections, hero
 * media, layout template, launch scheduler with countdown toggle") adds
 * `type: 'automated'`, `rules[]`, `heroImageMobile`, and `isTeaserVisible`
 * on top of the P1 manually-curated shape — extending the *existing*
 * catalog concern rather than building a second parallel "collection" model
 * in `content`, per that phase's own explicit instruction.
 */
export const CollectionType = z.enum(['seasonal', 'brand', 'editorial', 'sale', 'automated']);
export type CollectionType = z.infer<typeof CollectionType>;

export const CollectionStatus = z.enum(['draft', 'scheduled', 'active', 'ended']);
export type CollectionStatus = z.infer<typeof CollectionStatus>;

export const CollectionLayout = z.enum(['grid', 'editorial', 'lookbook', 'split']);
export type CollectionLayout = z.infer<typeof CollectionLayout>;

/** plan.md §7.9: `rules: [{ field, operator, value }]` — the automated-
 *  collection membership engine. `field` is restricted to the allowlist
 *  `collection.rules.ts` (catalog) knows how to translate into
 *  `product.repository.ts`'s existing `ProductListFilter` — not an
 *  arbitrary Mongo query built from admin input. */
export const CollectionRuleOperator = z.enum(['eq', 'in', 'gte', 'lte', 'contains']);
export type CollectionRuleOperator = z.infer<typeof CollectionRuleOperator>;

export const CollectionRuleField = z.enum([
  'brandId',
  'categoryId',
  'stitchingType',
  'fabric',
  'work',
  'occasion',
  'colorFamily',
  'priceFils',
  'onSale',
  'inStock',
]);
export type CollectionRuleField = z.infer<typeof CollectionRuleField>;

export const CollectionRule = z.object({
  field: CollectionRuleField,
  operator: CollectionRuleOperator,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});
export type CollectionRule = z.infer<typeof CollectionRule>;

export const Collection = z.object({
  id: objectId,
  name: z.string(),
  nameAr: z.string(),
  slug: z.string(),
  subtitle: z.string(),
  descriptionEn: z.string(),
  descriptionAr: z.string(),
  brandId: objectId.nullable(), // brand collection vs. house edit
  type: CollectionType,
  // `rules[]|null` per plan.md §7.9's literal shape is represented as a
  // plain (possibly empty) array instead, matching `productIds`' own
  // established convention in this same schema — empty means "no rules",
  // never populated for a manually-curated collection.
  rules: z.array(CollectionRule),
  productIds: z.array(objectId), // manual, ordered — ignored for `type: 'automated'`, see collection.service.ts
  heroImage: MediaRef.nullable(),
  heroImageMobile: MediaRef.nullable(),
  launchAt: z.coerce.date().nullable(),
  endAt: z.coerce.date().nullable(),
  isTeaserVisible: z.boolean(), // show a countdown before launch
  status: CollectionStatus,
  layout: CollectionLayout,
  sortOrder: z.number().int(),
  isFeatured: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Collection = z.infer<typeof Collection>;
