import type { Banner, PublicBanner } from '@lulwah/contracts';
import type { BannerDoc, BannerHydratedDoc } from './banner.model.js';
import { toMediaRefDto } from './media-ref.mapper.js';

export function toBannerDto(doc: BannerDoc | BannerHydratedDoc): Banner {
  return {
    id: doc._id.toString(),
    placement: doc.placement,
    mediaDesktop: toMediaRefDto(doc.mediaDesktop),
    mediaMobile: toMediaRefDto(doc.mediaMobile),
    link: doc.link,
    textEn: doc.textEn,
    textAr: doc.textAr,
    isActive: doc.isActive,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toPublicBannerDto(doc: BannerDoc | BannerHydratedDoc): PublicBanner {
  return {
    id: doc._id.toString(),
    placement: doc.placement,
    mediaDesktop: toMediaRefDto(doc.mediaDesktop),
    mediaMobile: toMediaRefDto(doc.mediaMobile),
    link: doc.link,
    textEn: doc.textEn,
    textAr: doc.textAr,
  };
}
