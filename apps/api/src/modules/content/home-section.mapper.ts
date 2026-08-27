import type { HomeSection, PublicHomeSection } from '@lulwah/contracts';
import type { HomeSectionDoc, HomeSectionHydratedDoc } from './home-section.model.js';

export function toHomeSectionDto(doc: HomeSectionDoc | HomeSectionHydratedDoc): HomeSection {
  return {
    id: doc._id.toString(),
    type: doc.type,
    settings: doc.settings,
    sortOrder: doc.sortOrder,
    isActive: doc.isActive,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toPublicHomeSectionDto(doc: HomeSectionDoc | HomeSectionHydratedDoc): PublicHomeSection {
  return {
    id: doc._id.toString(),
    type: doc.type,
    settings: doc.settings,
    sortOrder: doc.sortOrder,
  };
}
