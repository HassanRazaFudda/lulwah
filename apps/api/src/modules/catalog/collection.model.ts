import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { MediaRefSubdoc } from './brand.model.js';

/**
 * Mongoose schema for `collections` — plan.md §7.9. `type: 'automated'` and
 * `rules[]` are intentionally not modeled — manual `productIds` only, per
 * the brief's scope note (an automated rules engine is future work).
 */

const mediaRefSchema = new Schema<MediaRefSubdoc>(
  { publicId: { type: String, required: true }, url: { type: String, required: true }, width: { type: Number, default: null }, height: { type: Number, default: null } },
  { _id: false },
);

export type CollectionType = 'seasonal' | 'brand' | 'editorial' | 'sale';
export type CollectionStatus = 'draft' | 'scheduled' | 'active' | 'ended';
export type CollectionLayout = 'grid' | 'editorial' | 'lookbook' | 'split';

export interface CollectionDoc {
  _id: Types.ObjectId;
  name: string;
  nameAr: string;
  slug: string;
  subtitle: string;
  descriptionEn: string;
  descriptionAr: string;
  brandId: Types.ObjectId | null;
  type: CollectionType;
  productIds: Types.ObjectId[];
  heroImage: MediaRefSubdoc | null;
  launchAt: Date | null;
  endAt: Date | null;
  status: CollectionStatus;
  layout: CollectionLayout;
  sortOrder: number;
  isFeatured: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const collectionSchema = new Schema<CollectionDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, default: '' },
    slug: { type: String, required: true, lowercase: true, trim: true },
    subtitle: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    descriptionAr: { type: String, default: '' },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', default: null },
    type: { type: String, enum: ['seasonal', 'brand', 'editorial', 'sale'], required: true },
    productIds: { type: [Schema.Types.ObjectId], ref: 'Product', default: [] },
    heroImage: { type: mediaRefSchema, default: null },
    launchAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    status: { type: String, enum: ['draft', 'scheduled', 'active', 'ended'], required: true, default: 'draft' },
    layout: { type: String, enum: ['grid', 'editorial', 'lookbook', 'split'], required: true, default: 'grid' },
    sortOrder: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'collections' },
);

collectionSchema.index({ slug: 1 }, { unique: true });
collectionSchema.index({ status: 1, sortOrder: 1 });

export type CollectionHydratedDoc = HydratedDocument<CollectionDoc>;
export const CollectionModel = model<CollectionDoc>('Collection', collectionSchema);
