import { z } from 'zod';
import { Menu, MenuLocation, MediaRef, PublicMenu } from '@lulwah/contracts';

export interface MenuItemInputNode {
  // `| undefined` explicitly — `exactOptionalPropertyTypes` (plan.md
  // §27.1) needs it to line up with what `z.ZodType<MenuItemInputNode>`'s
  // `.optional()` field actually infers.
  id?: string | undefined;
  label: string;
  labelAr: string;
  href: string;
  featuredMedia: MediaRef | null;
  badge: string | null;
  sortOrder: number;
  children: MenuItemInputNode[];
}

/** The admin-write counterpart to `@lulwah/contracts`' recursive `MenuItem`
 *  — `id` is optional here (`menu.service.ts` assigns one to any new node,
 *  same `randomUUID()`-on-write pattern `catalog/media.service.ts` uses for
 *  product media items), everything else mirrors the read shape 1:1. */
export const MenuItemInput: z.ZodType<MenuItemInputNode> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    label: z.string().min(1),
    labelAr: z.string().default(''),
    href: z.string(),
    featuredMedia: MediaRef.nullable().default(null),
    badge: z.string().nullable().default(null),
    sortOrder: z.number().int().default(0),
    children: z.array(MenuItemInput).default([]),
  }),
);

export const AdminCreateMenuInput = z.object({
  location: MenuLocation,
  items: z.array(MenuItemInput).default([]),
  isActive: z.boolean().default(true),
});
export type AdminCreateMenuInput = z.infer<typeof AdminCreateMenuInput>;

/** `location` is deliberately not editable — it's the menu's own lookup
 *  key (`@lulwah/contracts`' `Menu` doc comment); changing it would just
 *  mean "make a different menu", handled by delete + create instead. */
export const AdminUpdateMenuInput = z.object({
  items: z.array(MenuItemInput).optional(),
  isActive: z.boolean().optional(),
});
export type AdminUpdateMenuInput = z.infer<typeof AdminUpdateMenuInput>;

export const AdminMenuListResponse = z.object({ menus: z.array(Menu) });
export type AdminMenuListResponse = z.infer<typeof AdminMenuListResponse>;

export const AdminMenuResponse = z.object({ menu: Menu });
export type AdminMenuResponse = z.infer<typeof AdminMenuResponse>;

export const PublicMenuResponse = z.object({ menu: PublicMenu });
export type PublicMenuResponse = z.infer<typeof PublicMenuResponse>;
