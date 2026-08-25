import type { PartialWithUndefined } from '../../shared/types.js';
import { AddressModel } from './address.model.js';
import type { AddressDoc, AddressHydratedDoc } from './address.model.js';

/** The ONLY file allowed to touch `AddressModel` (plan.md §5.4). */

const NOT_DELETED = { deletedAt: null };

export type CreateAddressInput = Omit<AddressDoc, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'userId'> & { userId: string };
export type UpdateAddressInput = PartialWithUndefined<Omit<CreateAddressInput, 'userId'>>;

export async function createAddress(input: CreateAddressInput): Promise<AddressHydratedDoc> {
  return AddressModel.create(input as unknown as Parameters<typeof AddressModel.create>[0]);
}

export async function findAddressesByUserId(userId: string): Promise<AddressHydratedDoc[]> {
  return AddressModel.find({ userId, ...NOT_DELETED }).sort({ isDefaultShipping: -1, createdAt: -1 }).exec();
}

export async function findAddressById(id: string): Promise<AddressHydratedDoc | null> {
  return AddressModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function findAddressForUser(id: string, userId: string): Promise<AddressHydratedDoc | null> {
  return AddressModel.findOne({ _id: id, userId, ...NOT_DELETED }).exec();
}

export async function updateAddress(id: string, userId: string, input: UpdateAddressInput): Promise<AddressHydratedDoc | null> {
  return AddressModel.findOneAndUpdate({ _id: id, userId, ...NOT_DELETED }, input as unknown as Parameters<typeof AddressModel.findOneAndUpdate>[1], { returnDocument: 'after' }).exec();
}

export async function softDeleteAddress(id: string, userId: string): Promise<boolean> {
  const result = await AddressModel.updateOne({ _id: id, userId, ...NOT_DELETED }, { deletedAt: new Date() }).exec();
  return result.modifiedCount > 0;
}

/** Clears every other address' default-shipping flag for this user before
 *  the caller (`address.service.ts`) sets a new one — an address book has
 *  at most one default shipping address at a time. */
export async function clearDefaultShippingForUser(userId: string, exceptId?: string): Promise<void> {
  await AddressModel.updateMany({ userId, ...NOT_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, { isDefaultShipping: false }).exec();
}

export async function setDefaultShipping(id: string, userId: string): Promise<AddressHydratedDoc | null> {
  return AddressModel.findOneAndUpdate({ _id: id, userId, ...NOT_DELETED }, { isDefaultShipping: true }, { returnDocument: 'after' }).exec();
}
