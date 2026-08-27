import { randomUUID } from 'node:crypto';
import type { Menu, PublicMenu } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './menu.repository.js';
import type { MenuItemRepoInput } from './menu.repository.js';
import { toMenuDto, toPublicMenuDto } from './menu.mapper.js';
import { contentEvents } from './content.events.js';
import type { MenuItemInputNode } from './menu.dto.js';
import type { AdminCreateMenuInput, AdminUpdateMenuInput } from './menu.dto.js';

function isDuplicateLocationError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

/** Assigns a stable `id` to every node that doesn't already have one — a
 *  brand-new item dragged into the tree by the (future) admin UI arrives
 *  without one, same `randomUUID()`-on-write pattern
 *  `catalog/media.service.ts#addProductMedia` uses for a new media item.
 *  An existing item keeps the id it already had, so reordering/nesting
 *  doesn't churn ids on every save. */
function assignItemIds(items: readonly MenuItemInputNode[]): MenuItemRepoInput[] {
  return items.map((item) => ({
    id: item.id ?? randomUUID(),
    label: item.label,
    labelAr: item.labelAr,
    href: item.href,
    featuredMedia: item.featuredMedia,
    badge: item.badge,
    sortOrder: item.sortOrder,
    children: assignItemIds(item.children),
  }));
}

export async function adminListMenus(actor: AuthenticatedUser): Promise<Menu[]> {
  assertPermission(actor, 'content.read');
  const docs = await repo.listMenus();
  return docs.map(toMenuDto);
}

export async function adminGetMenu(actor: AuthenticatedUser, id: string): Promise<Menu> {
  assertPermission(actor, 'content.read');
  const doc = await repo.findMenuById(id);
  if (!doc) throw notFoundError('Menu not found.');
  return toMenuDto(doc);
}

export async function createMenu(actor: AuthenticatedUser, input: AdminCreateMenuInput): Promise<Menu> {
  assertPermission(actor, 'content.write');
  try {
    const doc = await repo.createMenu({ location: input.location, isActive: input.isActive, items: assignItemIds(input.items) });
    contentEvents.publish('menu.updated', { location: doc.location });
    return toMenuDto(doc);
  } catch (err) {
    if (isDuplicateLocationError(err)) {
      throw new AppError('CONFLICT', 409, { messageEn: `A menu for location "${input.location}" already exists.`, field: 'location' });
    }
    throw err;
  }
}

export async function updateMenu(actor: AuthenticatedUser, id: string, input: AdminUpdateMenuInput): Promise<Menu> {
  assertPermission(actor, 'content.write');
  const doc = await repo.updateMenu(id, {
    ...(input.items !== undefined ? { items: assignItemIds(input.items) } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });
  if (!doc) throw notFoundError('Menu not found.');
  contentEvents.publish('menu.updated', { location: doc.location });
  return toMenuDto(doc);
}

export async function deleteMenu(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'content.write');
  const existing = await repo.findMenuById(id);
  if (!existing) throw notFoundError('Menu not found.');
  await repo.softDeleteMenu(id);
  contentEvents.publish('menu.updated', { location: existing.location });
}

/** `GET /content/menus/:key` — `location` doubles as the lookup key (see
 *  `@lulwah/contracts`' `Menu` doc comment). Only an active menu is ever
 *  exposed publicly. */
export async function getPublicMenuByLocation(location: Menu['location']): Promise<PublicMenu> {
  const doc = await repo.findMenuByLocation(location);
  if (!doc || !doc.isActive) throw notFoundError('Menu not found.');
  return toPublicMenuDto(doc);
}
