import { slugify } from '@lulwah/utils';
import type { Brand } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './brand.repository.js';
import { toBrandDto } from './brand.mapper.js';
import type { AdminCreateBrandInput, AdminUpdateBrandInput } from './brand.dto.js';

function isDuplicateSlugError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

export async function listPublicBrands(): Promise<Brand[]> {
  const docs = await repo.listActiveBrands();
  return docs.map(toBrandDto);
}

export async function getBrandBySlug(slug: string): Promise<Brand> {
  const doc = await repo.findBrandBySlug(slug);
  if (!doc || !doc.isActive) throw notFoundError('Brand not found.');
  return toBrandDto(doc);
}

export async function adminListBrands(actor: AuthenticatedUser, page: number, limit: number): Promise<{ brands: Brand[]; total: number }> {
  assertPermission(actor, 'products.read');
  const { brands, total } = await repo.listAllBrands(page, limit);
  return { brands: brands.map(toBrandDto), total };
}

export async function adminGetBrand(actor: AuthenticatedUser, id: string): Promise<Brand> {
  assertPermission(actor, 'products.read');
  const doc = await repo.findBrandById(id);
  if (!doc) throw notFoundError('Brand not found.');
  return toBrandDto(doc);
}

export async function createBrand(actor: AuthenticatedUser, input: AdminCreateBrandInput): Promise<Brand> {
  assertPermission(actor, 'products.write');
  try {
    const doc = await repo.createBrand({ ...input, slug: input.slug ?? slugify(input.name) });
    return toBrandDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A brand with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function updateBrand(actor: AuthenticatedUser, id: string, input: AdminUpdateBrandInput): Promise<Brand> {
  assertPermission(actor, 'products.write');
  try {
    const doc = await repo.updateBrand(id, input);
    if (!doc) throw notFoundError('Brand not found.');
    return toBrandDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A brand with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function deleteBrand(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'products.write');
  const deleted = await repo.softDeleteBrand(id);
  if (!deleted) throw notFoundError('Brand not found.');
}
