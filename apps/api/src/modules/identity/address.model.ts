import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { Emirate } from '@lulwah/contracts';

/**
 * Mongoose schema for `addresses` — plan.md §7.2. `identity` owns `User`
 * and `Address` both (plan.md §5.3's module-ownership table lists `Address`
 * under `identity` — a customer's address book is naturally part of their
 * profile, not a separate module). Mirrors `@lulwah/contracts`' `Address`
 * Zod schema field-for-field.
 *
 * **UAE addressing, verbatim from the plan:** no postcodes, unreliable
 * street numbers — the form is area + building + landmark, not "Address
 * line 1 / ZIP." `area`/`landmark` are required for exactly this reason;
 * `makani` (Dubai's own geocoding number) and `poBox` are optional extras,
 * not replacements.
 */

export interface AddressPhoneSubdoc {
  countryCode: '+971';
  number: string;
}

const addressPhoneSchema = new Schema<AddressPhoneSubdoc>(
  { countryCode: { type: String, enum: ['+971'], required: true }, number: { type: String, required: true } },
  { _id: false },
);

export interface AddressGeoSubdoc {
  lat: number;
  lng: number;
}

const addressGeoSchema = new Schema<AddressGeoSubdoc>({ lat: { type: Number, required: true }, lng: { type: Number, required: true } }, { _id: false });

export interface AddressDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  label: 'home' | 'work' | 'other';
  firstName: string;
  lastName: string;
  phone: AddressPhoneSubdoc;
  emirate: Emirate;
  city: string;
  area: string;
  buildingName: string;
  apartment: string | null;
  street: string | null;
  landmark: string;
  makani: string | null;
  poBox: string | null;
  country: 'AE';
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  geo: AddressGeoSubdoc | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<AddressDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, enum: ['home', 'work', 'other'], required: true, default: 'home' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: addressPhoneSchema, required: true },
    emirate: {
      type: String,
      enum: ['dubai', 'abu_dhabi', 'sharjah', 'ajman', 'ras_al_khaimah', 'fujairah', 'umm_al_quwain'],
      required: true,
    },
    city: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    buildingName: { type: String, required: true, trim: true },
    apartment: { type: String, default: null },
    street: { type: String, default: null },
    landmark: { type: String, required: true, trim: true },
    makani: { type: String, default: null },
    poBox: { type: String, default: null },
    country: { type: String, enum: ['AE'], required: true, default: 'AE' },
    isDefaultShipping: { type: Boolean, default: false },
    isDefaultBilling: { type: Boolean, default: false },
    geo: { type: addressGeoSchema, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'addresses' },
);

addressSchema.index({ userId: 1 });
addressSchema.index({ userId: 1, isDefaultShipping: 1 });

export type AddressHydratedDoc = HydratedDocument<AddressDoc>;
export const AddressModel = model<AddressDoc>('Address', addressSchema);
