import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `pages` — plan.md §7.13: "slug, titleEn/Ar,
 * bodyEn/Ar(rich), status, seo". `content` owns this model (plan.md §5.3);
 * only `page.repository.ts` may import it (§5.4). `bodyEn`/`bodyAr` are
 * stored already-sanitized (`page.service.ts` runs `sanitize.ts` before
 * every write) — never raw admin HTML.
 */

export type PageStatus = 'draft' | 'published';

export interface PageSeoSubdoc {
  titleEn: string | null;
  titleAr: string | null;
  descEn: string | null;
  descAr: string | null;
}

const pageSeoSchema = new Schema<PageSeoSubdoc>(
  {
    titleEn: { type: String, default: null },
    titleAr: { type: String, default: null },
    descEn: { type: String, default: null },
    descAr: { type: String, default: null },
  },
  { _id: false },
);

export interface PageDoc {
  _id: Types.ObjectId;
  slug: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  status: PageStatus;
  seo: PageSeoSubdoc;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<PageDoc>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    titleEn: { type: String, required: true, trim: true },
    titleAr: { type: String, default: '' },
    bodyEn: { type: String, default: '' },
    bodyAr: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], required: true, default: 'draft' },
    seo: { type: pageSeoSchema, default: () => ({}) },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'pages' },
);

pageSchema.index({ slug: 1 }, { unique: true });
pageSchema.index({ status: 1 });

export type PageHydratedDoc = HydratedDocument<PageDoc>;
export const PageModel = model<PageDoc>('Page', pageSchema);
