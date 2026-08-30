import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { mediaRefSchema } from './media-ref.schema.js';
import type { MediaRefSubdoc } from './media-ref.schema.js';

/**
 * Mongoose schema for `lookbooks` — plan.md §11.1's content-domain table
 * lists `Lookbook` as its own `content` entity (see `@lulwah/contracts`'
 * `content.ts` doc comment on `Lookbook` for how this relates to
 * `Collection.layout`'s `'lookbook'` value/`lookbookMedia` field). `content`
 * owns this model (plan.md §5.3); only `lookbook.repository.ts` may import
 * it (§5.4). `bodyEn`/`bodyAr` are stored already-sanitized
 * (`lookbook.service.ts` runs `sanitize.ts` before every write), same rule
 * `page.model.ts` documents.
 */

export type LookbookStatus = 'draft' | 'published';

export interface LookbookSeoSubdoc {
  titleEn: string | null;
  titleAr: string | null;
  descEn: string | null;
  descAr: string | null;
}

const lookbookSeoSchema = new Schema<LookbookSeoSubdoc>(
  {
    titleEn: { type: String, default: null },
    titleAr: { type: String, default: null },
    descEn: { type: String, default: null },
    descAr: { type: String, default: null },
  },
  { _id: false },
);

export interface LookbookDoc {
  _id: Types.ObjectId;
  slug: string;
  titleEn: string;
  titleAr: string;
  heroMedia: MediaRefSubdoc | null;
  heroMediaMobile: MediaRefSubdoc | null;
  gallery: MediaRefSubdoc[];
  bodyEn: string;
  bodyAr: string;
  collectionId: Types.ObjectId | null;
  status: LookbookStatus;
  seo: LookbookSeoSubdoc;
  sortOrder: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const lookbookSchema = new Schema<LookbookDoc>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    titleEn: { type: String, required: true, trim: true },
    titleAr: { type: String, default: '' },
    heroMedia: { type: mediaRefSchema, default: null },
    heroMediaMobile: { type: mediaRefSchema, default: null },
    gallery: { type: [mediaRefSchema], default: [] },
    bodyEn: { type: String, default: '' },
    bodyAr: { type: String, default: '' },
    collectionId: { type: Schema.Types.ObjectId, default: null },
    status: { type: String, enum: ['draft', 'published'], required: true, default: 'draft' },
    seo: { type: lookbookSeoSchema, default: () => ({}) },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'lookbooks' },
);

lookbookSchema.index({ slug: 1 }, { unique: true });
lookbookSchema.index({ status: 1, sortOrder: 1 });

export type LookbookHydratedDoc = HydratedDocument<LookbookDoc>;
export const LookbookModel = model<LookbookDoc>('Lookbook', lookbookSchema);
