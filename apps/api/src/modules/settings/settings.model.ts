import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { Emirate } from '@lulwah/contracts';

/**
 * Mongoose schema for the `settings` collection — plan.md §11.1. A
 * genuine singleton: exactly one document ever exists, addressed by the
 * fixed `_id` string `SETTINGS_SINGLETON_ID` (same "well-known string
 * `_id`" convention `order.model.ts`'s per-date `CounterModel` already
 * uses, rather than a real `ObjectId` nothing would ever look up by).
 * `settings.repository.ts` is the ONLY file allowed to touch this model
 * (plan.md §5.4).
 */

export const SETTINGS_SINGLETON_ID = 'global';

export interface ShippingRateSubdoc {
  emirate: Emirate;
  feeFils: number;
  etaMinDays: number;
  etaMaxDays: number;
}

const shippingRateSchema = new Schema<ShippingRateSubdoc>(
  {
    emirate: { type: String, required: true },
    feeFils: { type: Number, required: true },
    etaMinDays: { type: Number, required: true },
    etaMaxDays: { type: Number, required: true },
  },
  { _id: false },
);

export interface StoreAddressSubdoc {
  line1: string;
  line2: string;
  city: string;
  emirate: Emirate;
  country: 'AE';
}

const storeAddressSchema = new Schema<StoreAddressSubdoc>(
  {
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    city: { type: String, default: '' },
    emirate: { type: String, default: 'dubai' },
    country: { type: String, default: 'AE' },
  },
  { _id: false },
);

export interface StoreDetailsSubdoc {
  name: string;
  trn: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: StoreAddressSubdoc;
}

const storeDetailsSchema = new Schema<StoreDetailsSubdoc>(
  {
    name: { type: String, default: '' },
    trn: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    address: { type: storeAddressSchema, default: () => ({}) },
  },
  { _id: false },
);

export interface ShippingSettingsSubdoc {
  rates: ShippingRateSubdoc[];
  freeShippingThresholdFils: number;
}

const shippingSettingsSchema = new Schema<ShippingSettingsSubdoc>(
  { rates: { type: [shippingRateSchema], default: [] }, freeShippingThresholdFils: { type: Number, required: true } },
  { _id: false },
);

export interface CodSettingsSubdoc {
  feeFils: number;
  maxOrderFils: number;
}

const codSettingsSchema = new Schema<CodSettingsSubdoc>(
  { feeFils: { type: Number, required: true }, maxOrderFils: { type: Number, required: true } },
  { _id: false },
);

export interface SettingsDoc {
  _id: string;
  storeDetails: StoreDetailsSubdoc;
  shipping: ShippingSettingsSubdoc;
  cod: CodSettingsSubdoc;
  taxRate: number;
  /** A simple string→boolean map (plan.md §11.1) — `Schema.Types.Mixed`
   *  rather than `Schema.Types.Map`, matching `order.model.ts`'s own
   *  `measurementSnapshot` precedent for "plain object, not a real Mongoose
   *  Map instance a mapper would have to convert". */
  featureFlags: Record<string, boolean>;
  maintenanceMode: boolean;
  updatedByUserId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<SettingsDoc>(
  {
    _id: { type: String },
    storeDetails: { type: storeDetailsSchema, default: () => ({}) },
    shipping: { type: shippingSettingsSchema, required: true },
    cod: { type: codSettingsSchema, required: true },
    taxRate: { type: Number, required: true },
    featureFlags: { type: Schema.Types.Mixed, default: () => ({}) },
    maintenanceMode: { type: Boolean, default: false },
    updatedByUserId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: 'settings' },
);

export type SettingsHydratedDoc = HydratedDocument<SettingsDoc>;
export const SettingsModel = model<SettingsDoc>('Settings', settingsSchema);
