import type { JournalPost, PublicJournalPost } from '@lulwah/contracts';
import type { JournalPostDoc, JournalPostHydratedDoc } from './journal.model.js';
import { toMediaRefDto } from './media-ref.mapper.js';

function toJournalPostSeoDto(seo: JournalPostDoc['seo']): JournalPost['seo'] {
  return {
    ...(seo.titleEn !== null ? { titleEn: seo.titleEn } : {}),
    ...(seo.titleAr !== null ? { titleAr: seo.titleAr } : {}),
    ...(seo.descEn !== null ? { descEn: seo.descEn } : {}),
    ...(seo.descAr !== null ? { descAr: seo.descAr } : {}),
  };
}

export function toJournalPostDto(doc: JournalPostDoc | JournalPostHydratedDoc): JournalPost {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    titleEn: doc.titleEn,
    titleAr: doc.titleAr,
    coverMedia: toMediaRefDto(doc.coverMedia),
    excerptEn: doc.excerptEn,
    excerptAr: doc.excerptAr,
    bodyEn: doc.bodyEn,
    bodyAr: doc.bodyAr,
    publishedAt: doc.publishedAt,
    status: doc.status,
    seo: toJournalPostSeoDto(doc.seo),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toPublicJournalPostDto(doc: JournalPostDoc | JournalPostHydratedDoc): PublicJournalPost {
  return {
    slug: doc.slug,
    titleEn: doc.titleEn,
    titleAr: doc.titleAr,
    coverMedia: toMediaRefDto(doc.coverMedia),
    excerptEn: doc.excerptEn,
    excerptAr: doc.excerptAr,
    bodyEn: doc.bodyEn,
    bodyAr: doc.bodyAr,
    publishedAt: doc.publishedAt,
    seo: toJournalPostSeoDto(doc.seo),
  };
}
