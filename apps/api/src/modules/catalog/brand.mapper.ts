import type { Brand } from '@lulwah/contracts';
import type { BrandDoc, BrandHydratedDoc } from './brand.model.js';
import { toMediaRefDto } from './media.mapper.js';

export function toBrandDto(doc: BrandDoc | BrandHydratedDoc): Brand {
  return {
    id: doc._id.toString(),
    name: doc.name,
    nameAr: doc.nameAr,
    slug: doc.slug,
    description: doc.description,
    descriptionAr: doc.descriptionAr,
    logo: toMediaRefDto(doc.logo),
    coverImage: toMediaRefDto(doc.coverImage),
    countryOfOrigin: doc.countryOfOrigin,
    sortOrder: doc.sortOrder,
    isFeatured: doc.isFeatured,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
