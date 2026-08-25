import type { Address, AddressSnapshot } from '@lulwah/contracts';
import { notFoundError } from '../../shared/errors.js';
import * as repo from './address.repository.js';
import { toAddressDto } from './address.mapper.js';
import type { CreateAddressInput, UpdateAddressInput } from './address.dto.js';

/**
 * ALL address business rules live here, framework-free (no `express`).
 * plan.md §9.4: every route requires a logged-in customer managing their
 * own address book — every function here takes `userId` and every
 * repository call is scoped by it, so one customer can never read/edit
 * another's address by guessing an id.
 */

export async function listAddresses(userId: string): Promise<Address[]> {
  const docs = await repo.findAddressesByUserId(userId);
  return docs.map(toAddressDto);
}

/** The very first address in an empty address book is automatically the
 *  default shipping/billing address — otherwise a brand-new account would
 *  have no default at all until the customer remembers to set one. */
export async function createAddress(userId: string, input: CreateAddressInput): Promise<Address> {
  const existing = await repo.findAddressesByUserId(userId);
  const isFirst = existing.length === 0;
  const wantsDefaultShipping = isFirst || input.isDefaultShipping;
  const wantsDefaultBilling = isFirst || input.isDefaultBilling;

  if (wantsDefaultShipping) await repo.clearDefaultShippingForUser(userId);

  const doc = await repo.createAddress({
    userId,
    label: input.label,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    emirate: input.emirate,
    city: input.city,
    area: input.area,
    buildingName: input.buildingName,
    apartment: input.apartment ?? null,
    street: input.street ?? null,
    landmark: input.landmark,
    makani: input.makani,
    poBox: input.poBox,
    country: 'AE',
    isDefaultShipping: wantsDefaultShipping,
    isDefaultBilling: wantsDefaultBilling,
    geo: input.geo,
  });
  return toAddressDto(doc);
}

export async function updateAddress(userId: string, id: string, input: UpdateAddressInput): Promise<Address> {
  const existing = await repo.findAddressForUser(id, userId);
  if (!existing) throw notFoundError('Address not found.');

  if (input.isDefaultShipping) await repo.clearDefaultShippingForUser(userId, id);

  const updated = await repo.updateAddress(id, userId, {
    ...input,
    ...(input.apartment !== undefined ? { apartment: input.apartment ?? null } : {}),
    ...(input.street !== undefined ? { street: input.street ?? null } : {}),
  });
  if (!updated) throw notFoundError('Address not found.');
  return toAddressDto(updated);
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  const deleted = await repo.softDeleteAddress(id, userId);
  if (!deleted) throw notFoundError('Address not found.');
}

/**
 * `checkout`'s exclusive read-only entry point into `identity`'s address
 * book (plan.md §5.3) — returns an immutable, embeddable copy (plan.md
 * §7.11's snapshot rule) rather than the live `Address` (with its `id`/
 * `userId`/default-flag bookkeeping, none of which belongs on a checkout
 * session or an order). Scoped by `userId` like every other function in
 * this file — a checkout session can never snapshot another customer's
 * saved address by guessing an id. A narrow, deliberate extension of this
 * module (see `checkout` module's report).
 */
export async function getAddressSnapshot(userId: string, id: string): Promise<AddressSnapshot> {
  const doc = await repo.findAddressForUser(id, userId);
  if (!doc) throw notFoundError('Address not found.');
  const address = toAddressDto(doc);
  return {
    label: address.label,
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    emirate: address.emirate,
    city: address.city,
    area: address.area,
    buildingName: address.buildingName,
    ...(address.apartment !== undefined ? { apartment: address.apartment } : {}),
    ...(address.street !== undefined ? { street: address.street } : {}),
    landmark: address.landmark,
    makani: address.makani,
    poBox: address.poBox,
    country: address.country,
    geo: address.geo,
  };
}

/** `POST /me/addresses/:id/default` — plan.md §9.4. Sets this address as
 *  the account's default shipping address (and, since a customer's
 *  "default" almost always means one thing in practice, billing too —
 *  `Address` keeps them as two separate flags per plan.md §7.2 for the
 *  rare case a future billing-address flow needs to diverge, but this
 *  shortcut endpoint sets both). */
export async function setDefaultAddress(userId: string, id: string): Promise<Address> {
  const existing = await repo.findAddressForUser(id, userId);
  if (!existing) throw notFoundError('Address not found.');

  await repo.clearDefaultShippingForUser(userId, id);
  const updated = await repo.setDefaultShipping(id, userId);
  if (!updated) throw notFoundError('Address not found.');
  updated.isDefaultBilling = true;
  await updated.save();
  return toAddressDto(updated);
}
