import { z } from 'zod';
import { objectId } from './common.js';
import { MediaRef } from './product.js';

/**
 * Collection — plan.md §7.9. `type: 'automated'` and `rules[]` (the
 * facet-based auto-membership engine) are out of scope for this phase per
 * the brief — collections are manually curated (`productIds` only) until a
 * later pass builds the rules engine.
 */
export const CollectionType = z.enum(['seasonal', 'brand', 'editorial', 'sale']);
export type CollectionType = z.infer<typeof CollectionType>;

export const CollectionStatus = z.enum(['draft', 'scheduled', 'active', 'ended']);
export type CollectionStatus = z.infer<typeof CollectionStatus>;

export const CollectionLayout = z.enum(['grid', 'editorial', 'lookbook', 'split']);
export type CollectionLayout = z.infer<typeof CollectionLayout>;

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
  productIds: z.array(objectId), // manual, ordered
  heroImage: MediaRef.nullable(),
  launchAt: z.coerce.date().nullable(),
  endAt: z.coerce.date().nullable(),
  status: CollectionStatus,
  layout: CollectionLayout,
  sortOrder: z.number().int(),
  isFeatured: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Collection = z.infer<typeof Collection>;
