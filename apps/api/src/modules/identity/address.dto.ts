import { z } from 'zod';
import { Address, AddressLabel, Emirate, UserPhone } from '@lulwah/contracts';

/**
 * Request/response DTOs for `/me/addresses` — plan.md §9.4. `Address`
 * itself lives in `@lulwah/contracts` (reused, not redefined).
 *
 * `UpdateAddressInput` is built from `BASE_FIELDS` (no `.default()`
 * anywhere in it) rather than `CreateAddressInput.partial()` — see
 * `pricing.dto.ts`'s doc comment for why: Zod's `.partial()` still fires a
 * field's own `.default(...)` when that key is entirely absent from the
 * input, so a naive `.partial()` on the create schema would make `PATCH
 * /me/addresses/:id { city: 'New City' }` silently reset `isDefaultShipping`
 * to `false`, `makani`/`poBox`/`geo` to `null`, etc. on every partial edit.
 */

const BASE_FIELDS = {
  label: AddressLabel,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: UserPhone,
  emirate: Emirate,
  city: z.string().min(1),
  area: z.string().min(1),
  buildingName: z.string().min(1),
  apartment: z.string().optional(),
  street: z.string().optional(),
  landmark: z.string().min(1),
  makani: z.string().nullable(),
  poBox: z.string().nullable(),
  isDefaultShipping: z.boolean(),
  isDefaultBilling: z.boolean(),
  geo: z.object({ lat: z.number(), lng: z.number() }).nullable(),
};

export const CreateAddressInput = z.object({
  ...BASE_FIELDS,
  label: BASE_FIELDS.label.default('home'),
  makani: BASE_FIELDS.makani.default(null),
  poBox: BASE_FIELDS.poBox.default(null),
  isDefaultShipping: BASE_FIELDS.isDefaultShipping.default(false),
  isDefaultBilling: BASE_FIELDS.isDefaultBilling.default(false),
  geo: BASE_FIELDS.geo.default(null),
});
export type CreateAddressInput = z.infer<typeof CreateAddressInput>;

export const UpdateAddressInput = z.object(BASE_FIELDS).partial();
export type UpdateAddressInput = z.infer<typeof UpdateAddressInput>;

export const AddressResponse = z.object({ address: Address });
export type AddressResponse = z.infer<typeof AddressResponse>;

export const AddressListResponse = z.object({ addresses: z.array(Address) });
export type AddressListResponse = z.infer<typeof AddressListResponse>;
