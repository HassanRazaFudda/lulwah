import { z } from 'zod';
import { objectId } from './common.js';
import { Emirate } from './enums.js';
import { UserPhone } from './user.js';

/**
 * Address — plan.md §7.2.
 *
 * UAE addressing note (verbatim from the plan): there are no postcodes and
 * street numbers are unreliable. The address form is **area + building +
 * landmark**, not "Address line 1 / ZIP" — getting this wrong causes
 * failed deliveries. `area` is an autocomplete against a seeded list of
 * ~400 UAE areas, so it is required here, not optional.
 */
export const AddressLabel = z.enum(['home', 'work', 'other']);
export type AddressLabel = z.infer<typeof AddressLabel>;

export const Address = z.object({
  id: objectId,
  userId: objectId,
  label: AddressLabel,
  firstName: z.string(),
  lastName: z.string(),
  phone: UserPhone,
  emirate: Emirate,
  city: z.string(),
  area: z.string().min(1), // REQUIRED in UAE — e.g. 'Al Barsha', 'JLT'
  buildingName: z.string(),
  apartment: z.string().optional(),
  street: z.string().optional(),
  landmark: z.string().min(1), // UAE addressing needs this
  makani: z.string().nullable(), // Dubai Makani number — optional but gold for couriers
  poBox: z.string().nullable(),
  country: z.literal('AE'),
  isDefaultShipping: z.boolean(),
  isDefaultBilling: z.boolean(),
  geo: z.object({ lat: z.number(), lng: z.number() }).nullable(),
});
export type Address = z.infer<typeof Address>;

/**
 * An embedded, immutable copy of an address at order time — plan.md
 * §7.11's snapshot rule: an order must still show the correct shipping
 * address even if the customer later edits or deletes it from their
 * address book. No `id`/`userId` (it is not a reference) and no default
 * flags (meaningless on a one-off snapshot).
 */
export const AddressSnapshot = Address.omit({
  id: true,
  userId: true,
  isDefaultShipping: true,
  isDefaultBilling: true,
});
export type AddressSnapshot = z.infer<typeof AddressSnapshot>;
