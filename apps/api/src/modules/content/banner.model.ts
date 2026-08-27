import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { mediaRefSchema } from './media-ref.schema.js';
import type { MediaRefSubdoc } from './media-ref.schema.js';

/**
 * Mongoose schema for `banners` — plan.md §7.13: "placement, mediaDesktop,
 * mediaMobile, link, textEn/Ar, startsAt, endsAt". `content` owns this
 * model (plan.md §5.3); only `banner.repository.ts` may import it (§5.4).
 */

export type BannerPlacement = 'announcement' | 'homepage_top' | 'plp_top' | 'cart';

export interface BannerDoc {
  _id: Types.ObjectId;
  placement: BannerPlacement;
  mediaDesktop: MediaRefSubdoc | null;
  mediaMobile: MediaRefSubdoc | null;
  link: string | null;
  textEn: string;
  textAr: string;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  sortOrder: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<BannerDoc>(
  {
    placement: { type: String, enum: ['announcement', 'homepage_top', 'plp_top', 'cart'], required: true },
    mediaDesktop: { type: mediaRefSchema, default: null },
    mediaMobile: { type: mediaRefSchema, default: null },
    link: { type: String, default: null },
    textEn: { type: String, default: '' },
    textAr: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'banners' },
);

bannerSchema.index({ deletedAt: 1, placement: 1, sortOrder: 1 });
bannerSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

export type BannerHydratedDoc = HydratedDocument<BannerDoc>;
export const BannerModel = model<BannerDoc>('Banner', bannerSchema);
