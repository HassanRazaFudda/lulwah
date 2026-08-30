import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { mediaRefSchema } from './media-ref.schema.js';
import type { MediaRefSubdoc } from './media-ref.schema.js';

/**
 * Mongoose schema for `journal_posts` — plan.md §11.1's content-domain
 * table / the `/[locale]/journal /journal/[slug]` route, and the backing
 * store for `journal_teaser` home-section `postSlugs` (see
 * `@lulwah/contracts`' `content.ts` doc comment on
 * `JournalTeaserSectionSettings`). `content` owns this model (plan.md
 * §5.3); only `journal.repository.ts` may import it (§5.4). `bodyEn`/`bodyAr`
 * are stored already-sanitized, same rule `page.model.ts` documents.
 */

export type JournalPostStatus = 'draft' | 'published';

export interface JournalPostSeoSubdoc {
  titleEn: string | null;
  titleAr: string | null;
  descEn: string | null;
  descAr: string | null;
}

const journalPostSeoSchema = new Schema<JournalPostSeoSubdoc>(
  {
    titleEn: { type: String, default: null },
    titleAr: { type: String, default: null },
    descEn: { type: String, default: null },
    descAr: { type: String, default: null },
  },
  { _id: false },
);

export interface JournalPostDoc {
  _id: Types.ObjectId;
  slug: string;
  titleEn: string;
  titleAr: string;
  coverMedia: MediaRefSubdoc | null;
  excerptEn: string;
  excerptAr: string;
  bodyEn: string;
  bodyAr: string;
  publishedAt: Date | null;
  status: JournalPostStatus;
  seo: JournalPostSeoSubdoc;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const journalPostSchema = new Schema<JournalPostDoc>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    titleEn: { type: String, required: true, trim: true },
    titleAr: { type: String, default: '' },
    coverMedia: { type: mediaRefSchema, default: null },
    excerptEn: { type: String, default: '' },
    excerptAr: { type: String, default: '' },
    bodyEn: { type: String, default: '' },
    bodyAr: { type: String, default: '' },
    publishedAt: { type: Date, default: null },
    status: { type: String, enum: ['draft', 'published'], required: true, default: 'draft' },
    seo: { type: journalPostSeoSchema, default: () => ({}) },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'journal_posts' },
);

journalPostSchema.index({ slug: 1 }, { unique: true });
journalPostSchema.index({ status: 1, publishedAt: -1 });

export type JournalPostHydratedDoc = HydratedDocument<JournalPostDoc>;
export const JournalPostModel = model<JournalPostDoc>('JournalPost', journalPostSchema);
