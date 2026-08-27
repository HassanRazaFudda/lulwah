import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { mediaRefSchema } from './media-ref.schema.js';
import type { MediaRefSubdoc } from './media-ref.schema.js';

/**
 * Mongoose schema for `menus` — plan.md §7.13: "location, items:[{label,
 * labelAr, href, children[], featuredMedia, badge}]". `content` owns this
 * model (plan.md §5.3); only `menu.repository.ts` may import it (§5.4).
 *
 * `items` is a recursively self-referencing subdocument array (plan.md
 * §11.1: "nested drag-and-drop"). Mongoose has no way to reference a schema
 * from within its own field definitions at construction time, so the
 * documented pattern is to declare the schema first and `.add()` the
 * self-referencing field afterward.
 */

export type MenuLocation = 'header' | 'footer' | 'mobile';

export interface MenuItemSubdoc {
  id: string;
  label: string;
  labelAr: string;
  href: string;
  featuredMedia: MediaRefSubdoc | null;
  badge: string | null;
  sortOrder: number;
  children: MenuItemSubdoc[];
}

const menuItemSchema = new Schema<MenuItemSubdoc>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    labelAr: { type: String, default: '' },
    href: { type: String, required: true },
    featuredMedia: { type: mediaRefSchema, default: null },
    badge: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);
menuItemSchema.add({ children: { type: [menuItemSchema], default: [] } });

export interface MenuDoc {
  _id: Types.ObjectId;
  location: MenuLocation;
  items: MenuItemSubdoc[];
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const menuSchema = new Schema<MenuDoc>(
  {
    location: { type: String, enum: ['header', 'footer', 'mobile'], required: true },
    items: { type: [menuItemSchema], default: [] },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'menus' },
);

// One menu per location, same simple (non-partial) unique-index convention
// `collection.model.ts`/`product.model.ts` already use for `slug` — a
// soft-deleted menu keeps its location "taken", matching that existing,
// accepted limitation rather than introducing a different pattern here.
menuSchema.index({ location: 1 }, { unique: true });

export type MenuHydratedDoc = HydratedDocument<MenuDoc>;
export const MenuModel = model<MenuDoc>('Menu', menuSchema);
