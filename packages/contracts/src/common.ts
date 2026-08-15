import { z } from 'zod';

/**
 * A Mongo `ObjectId` on the wire is always its 24-char hex string form —
 * the API never leaks a raw BSON `ObjectId` into JSON. Shared here so
 * every schema that references another collection (`product.ts`,
 * `order.ts`, `cart.ts`, `user.ts`, `address.ts`, ...) uses one definition.
 */
export const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
export type ObjectId = z.infer<typeof objectId>;
