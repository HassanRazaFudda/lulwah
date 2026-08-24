import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `brands` — plan.md §7.3. `catalog` owns this model
 * (plan.md §5.3); only `brand.repository.ts` may import it (§5.4).
 */

export interface MediaRefSubdoc {
  publicId: string;
  url: string;
  width: number | null;
  height: number | null;
}

const mediaRefSchema = new Schema<MediaRefSubdoc>(
  { publicId: { type: String, required: true }, url: { type: String, required: true }, width: { type: Number, default: null }, height: { type: Number, default: null } },
  { _id: false },
);

export interface BrandDoc {
  _id: Types.ObjectId;
  name: string;
  nameAr: string;
  slug: string;
  description: string;
  descriptionAr: string;
  logo: MediaRefSubdoc | null;
  coverImage: MediaRefSubdoc | null;
  countryOfOrigin: string;
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<BrandDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, default: '' },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    descriptionAr: { type: String, default: '' },
    logo: { type: mediaRefSchema, default: null },
    coverImage: { type: mediaRefSchema, default: null },
    countryOfOrigin: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    sortOrder: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'brands' },
);

brandSchema.index({ slug: 1 }, { unique: true });
brandSchema.index({ isActive: 1, sortOrder: 1 });

export type BrandHydratedDoc = HydratedDocument<BrandDoc>;
export const BrandModel = model<BrandDoc>('Brand', brandSchema);
