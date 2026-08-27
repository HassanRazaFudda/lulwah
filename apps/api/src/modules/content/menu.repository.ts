import type { MediaRef } from '@lulwah/contracts';
import type { PartialWithUndefined } from '../../shared/types.js';
import { MenuModel } from './menu.model.js';
import type { MenuDoc, MenuHydratedDoc, MenuItemSubdoc } from './menu.model.js';
import { toMediaRefSubdoc } from './media-ref.mapper.js';

/** The ONLY file allowed to touch `MenuModel` (plan.md §5.4).
 *  `MenuItemRepoInput` mirrors `MenuItemSubdoc` but with a DTO-shaped
 *  `MediaRef` (optional width/height key) instead of Mongoose's always-
 *  present `MediaRefSubdoc` — same "typed against the input, not the
 *  Mongoose-native shape" pattern `brand.repository.ts` documents. `id` is
 *  required here: `menu.service.ts` has already assigned one to every node
 *  (new or existing) before this file ever sees it. */
export interface MenuItemRepoInput {
  id: string;
  label: string;
  labelAr: string;
  href: string;
  featuredMedia: MediaRef | null;
  badge: string | null;
  sortOrder: number;
  children: MenuItemRepoInput[];
}

function toMenuItemSubdoc(item: MenuItemRepoInput): MenuItemSubdoc {
  return {
    id: item.id,
    label: item.label,
    labelAr: item.labelAr,
    href: item.href,
    featuredMedia: toMediaRefSubdoc(item.featuredMedia),
    badge: item.badge,
    sortOrder: item.sortOrder,
    children: item.children.map(toMenuItemSubdoc),
  };
}

export type CreateMenuInput = Pick<MenuDoc, 'location'> & Partial<Pick<MenuDoc, 'isActive'>> & { items?: MenuItemRepoInput[] };
export type UpdateMenuInput = PartialWithUndefined<Omit<CreateMenuInput, 'location'>>;

const NOT_DELETED = { deletedAt: null };

export async function createMenu(input: CreateMenuInput): Promise<MenuHydratedDoc> {
  const { items, ...rest } = input;
  return MenuModel.create({ ...rest, ...(items !== undefined ? { items: items.map(toMenuItemSubdoc) } : {}) });
}

export async function findMenuById(id: string): Promise<MenuHydratedDoc | null> {
  return MenuModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function findMenuByLocation(location: MenuDoc['location']): Promise<MenuHydratedDoc | null> {
  return MenuModel.findOne({ location, ...NOT_DELETED }).exec();
}

export async function listMenus(): Promise<MenuHydratedDoc[]> {
  return MenuModel.find(NOT_DELETED).sort({ location: 1 }).exec();
}

export async function updateMenu(id: string, input: UpdateMenuInput): Promise<MenuHydratedDoc | null> {
  const { items, ...rest } = input;
  return MenuModel.findOneAndUpdate(
    { _id: id, ...NOT_DELETED },
    { ...rest, ...(items !== undefined ? { items: items.map(toMenuItemSubdoc) } : {}) },
    { returnDocument: 'after' },
  ).exec();
}

export async function softDeleteMenu(id: string): Promise<boolean> {
  const result = await MenuModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date() }).exec();
  return result.modifiedCount > 0;
}
