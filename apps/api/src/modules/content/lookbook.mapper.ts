import type { Lookbook, PublicLookbook } from '@lulwah/contracts';
import type { LookbookDoc, LookbookHydratedDoc } from './lookbook.model.js';
import { toMediaRefDto, toMediaRefDtoRequired } from './media-ref.mapper.js';

function toLookbookSeoDto(seo: LookbookDoc['seo']): Lookbook['seo'] {
  return {
    ...(seo.titleEn !== null ? { titleEn: seo.titleEn } : {}),
    ...(seo.titleAr !== null ? { titleAr: seo.titleAr } : {}),
    ...(seo.descEn !== null ? { descEn: seo.descEn } : {}),
    ...(seo.descAr !== null ? { descAr: seo.descAr } : {}),
  };
}

export function toLookbookDto(doc: LookbookDoc | LookbookHydratedDoc): Lookbook {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    titleEn: doc.titleEn,
    titleAr: doc.titleAr,
    heroMedia: toMediaRefDto(doc.heroMedia),
    heroMediaMobile: toMediaRefDto(doc.heroMediaMobile),
    gallery: doc.gallery.map(toMediaRefDtoRequired),
    bodyEn: doc.bodyEn,
    bodyAr: doc.bodyAr,
    collectionId: doc.collectionId ? doc.collectionId.toString() : null,
    status: doc.status,
    seo: toLookbookSeoDto(doc.seo),
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toPublicLookbookDto(doc: LookbookDoc | LookbookHydratedDoc): PublicLookbook {
  return {
    slug: doc.slug,
    titleEn: doc.titleEn,
    titleAr: doc.titleAr,
    heroMedia: toMediaRefDto(doc.heroMedia),
    heroMediaMobile: toMediaRefDto(doc.heroMediaMobile),
    gallery: doc.gallery.map(toMediaRefDtoRequired),
    bodyEn: doc.bodyEn,
    bodyAr: doc.bodyAr,
    collectionId: doc.collectionId ? doc.collectionId.toString() : null,
    seo: toLookbookSeoDto(doc.seo),
  };
}
