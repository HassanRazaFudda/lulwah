import type { Menu, MenuItemNode, PublicMenu } from '@lulwah/contracts';
import type { MenuDoc, MenuHydratedDoc, MenuItemSubdoc } from './menu.model.js';
import { toMediaRefDto } from './media-ref.mapper.js';

function toMenuItemDto(subdoc: MenuItemSubdoc): MenuItemNode {
  return {
    id: subdoc.id,
    label: subdoc.label,
    labelAr: subdoc.labelAr,
    href: subdoc.href,
    featuredMedia: toMediaRefDto(subdoc.featuredMedia),
    badge: subdoc.badge,
    sortOrder: subdoc.sortOrder,
    children: subdoc.children.map(toMenuItemDto),
  };
}

export function toMenuDto(doc: MenuDoc | MenuHydratedDoc): Menu {
  return {
    id: doc._id.toString(),
    location: doc.location,
    items: doc.items.map(toMenuItemDto),
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toPublicMenuDto(doc: MenuDoc | MenuHydratedDoc): PublicMenu {
  return { location: doc.location, items: doc.items.map(toMenuItemDto) };
}
