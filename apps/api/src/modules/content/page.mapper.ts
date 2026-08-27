import type { Page, PublicPage } from '@lulwah/contracts';
import type { PageDoc, PageHydratedDoc } from './page.model.js';

function toPageSeoDto(seo: PageDoc['seo']): Page['seo'] {
  return {
    ...(seo.titleEn !== null ? { titleEn: seo.titleEn } : {}),
    ...(seo.titleAr !== null ? { titleAr: seo.titleAr } : {}),
    ...(seo.descEn !== null ? { descEn: seo.descEn } : {}),
    ...(seo.descAr !== null ? { descAr: seo.descAr } : {}),
  };
}

export function toPageDto(doc: PageDoc | PageHydratedDoc): Page {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    titleEn: doc.titleEn,
    titleAr: doc.titleAr,
    bodyEn: doc.bodyEn,
    bodyAr: doc.bodyAr,
    status: doc.status,
    seo: toPageSeoDto(doc.seo),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toPublicPageDto(doc: PageDoc | PageHydratedDoc): PublicPage {
  return {
    slug: doc.slug,
    titleEn: doc.titleEn,
    titleAr: doc.titleAr,
    bodyEn: doc.bodyEn,
    bodyAr: doc.bodyAr,
    seo: toPageSeoDto(doc.seo),
  };
}
