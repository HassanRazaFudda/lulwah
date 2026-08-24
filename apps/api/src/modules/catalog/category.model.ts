import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { MediaRefSubdoc } from './brand.model.js';

/**
 * Mongoose schema for `categories` — plan.md §7.4, a tree via `parentId` +
 * a materialized `path` (e.g. `unstitched/lawn`) so breadcrumbs and facet
 * queries never have to walk the tree at request time.
 */

const mediaRefSchema = new Schema<MediaRefSubdoc>(
  { publicId: { type: String, required: true }, url: { type: String, required: true }, width: { type: Number, default: null }, height: { type: Number, default: null } },
  { _id: false },
);

export interface CategoryDoc {
  _id: Types.ObjectId;
  name: string;
  nameAr: string;
  slug: string;
  parentId: Types.ObjectId | null;
  path: string;
  level: number;
  image: MediaRefSubdoc | null;
  sortOrder: number;
  isActive: boolean;
  showInMenu: boolean;
  productCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, default: '' },
    slug: { type: String, required: true, lowercase: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    path: { type: String, required: true },
    level: { type: Number, required: true, default: 0 },
    image: { type: mediaRefSchema, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    showInMenu: { type: Boolean, default: true },
    productCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'categories' },
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1, sortOrder: 1 });
categorySchema.index({ path: 1 });

export type CategoryHydratedDoc = HydratedDocument<CategoryDoc>;
export const CategoryModel = model<CategoryDoc>('Category', categorySchema);
