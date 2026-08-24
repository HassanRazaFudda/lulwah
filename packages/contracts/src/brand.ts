import { z } from 'zod';
import { objectId } from './common.js';
import { MediaRef } from './product.js';

/**
 * Brand — plan.md §7.3. Trimmed to the fields the catalog endpoints and
 * storefront/admin actually need (name/slug/media/country + merchandising
 * flags) — `sizeChartId` and the full `SeoBlock` from the plan's literal
 * shape are left out for this pass, same trimming rationale `product.ts`
 * already documents for `Product`.
 */
export const Brand = z.object({
  id: objectId,
  name: z.string(),
  nameAr: z.string(),
  slug: z.string(),
  description: z.string(),
  descriptionAr: z.string(),
  logo: MediaRef.nullable(),
  coverImage: MediaRef.nullable(),
  countryOfOrigin: z.string().length(2), // ISO 3166-1 alpha-2, e.g. 'PK'
  sortOrder: z.number().int(),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Brand = z.infer<typeof Brand>;
