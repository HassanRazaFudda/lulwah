import type { Collection } from '@lulwah/contracts';
import type { CollectionDoc, CollectionHydratedDoc } from './collection.model.js';
import { toMediaRefDto } from './media.mapper.js';

export function toCollectionDto(doc: CollectionDoc | CollectionHydratedDoc): Collection {
  return {
    id: doc._id.toString(),
    name: doc.name,
    nameAr: doc.nameAr,
    slug: doc.slug,
    subtitle: doc.subtitle,
    descriptionEn: doc.descriptionEn,
    descriptionAr: doc.descriptionAr,
    brandId: doc.brandId ? doc.brandId.toString() : null,
    type: doc.type,
    productIds: doc.productIds.map((id) => id.toString()),
    heroImage: toMediaRefDto(doc.heroImage),
    launchAt: doc.launchAt,
    endAt: doc.endAt,
    status: doc.status,
    layout: doc.layout,
    sortOrder: doc.sortOrder,
    isFeatured: doc.isFeatured,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
