import { z } from 'zod';
import { Page, PageSeo, PageStatus } from '@lulwah/contracts';

/** See `collection.dto.ts`'s doc comment on `BASE_FIELDS` vs. deriving
 *  update from a defaulted create schema. */
const BASE_FIELDS = {
  slug: z.string().min(1).optional(),
  titleEn: z.string().min(1),
  titleAr: z.string(),
  bodyEn: z.string(),
  bodyAr: z.string(),
  status: PageStatus,
  seo: PageSeo,
};

export const AdminCreatePageInput = z.object({
  ...BASE_FIELDS,
  titleAr: BASE_FIELDS.titleAr.default(''),
  bodyEn: BASE_FIELDS.bodyEn.default(''),
  bodyAr: BASE_FIELDS.bodyAr.default(''),
  status: BASE_FIELDS.status.default('draft'),
  seo: BASE_FIELDS.seo.default({}),
});
export type AdminCreatePageInput = z.infer<typeof AdminCreatePageInput>;

export const AdminUpdatePageInput = z.object(BASE_FIELDS).partial();
export type AdminUpdatePageInput = z.infer<typeof AdminUpdatePageInput>;

export const AdminListPagesQuery = z.object({
  status: PageStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListPagesQuery = z.infer<typeof AdminListPagesQuery>;

export const AdminPageListResponse = z.object({ pages: z.array(Page) });
export type AdminPageListResponse = z.infer<typeof AdminPageListResponse>;

export const AdminPageResponse = z.object({ page: Page });
export type AdminPageResponse = z.infer<typeof AdminPageResponse>;
