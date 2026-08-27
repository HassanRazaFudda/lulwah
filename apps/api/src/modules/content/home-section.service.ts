import { HOME_SECTION_SETTINGS_SCHEMAS } from '@lulwah/contracts';
import type { HomeSection, PublicHomeSection } from '@lulwah/contracts';
import { validationError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './home-section.repository.js';
import type { HomeSectionType } from './home-section.model.js';
import { toHomeSectionDto, toPublicHomeSectionDto } from './home-section.mapper.js';
import { contentEvents } from './content.events.js';
import type { AdminCreateHomeSectionInput, AdminUpdateHomeSectionInput } from './home-section.dto.js';

/** Validates `settings` against the schema for `type` — the one place both
 *  create and update funnel through, so a PATCH that changes `settings`
 *  can never persist a shape that doesn't match its `type` (plan.md §11.1's
 *  "typed settings form", enforced server-side regardless of what an admin
 *  UI does or doesn't check client-side). */
function parseSettingsForType(type: HomeSectionType, settings: unknown): Record<string, unknown> {
  const schema = HOME_SECTION_SETTINGS_SCHEMAS[type];
  const result = schema.safeParse(settings);
  if (!result.success) {
    throw validationError(`Invalid settings for section type "${type}".`, 'settings', { issues: result.error.issues });
  }
  return result.data as Record<string, unknown>;
}

export async function adminListHomeSections(actor: AuthenticatedUser): Promise<HomeSection[]> {
  assertPermission(actor, 'content.read');
  const docs = await repo.listHomeSections();
  return docs.map(toHomeSectionDto);
}

export async function adminGetHomeSection(actor: AuthenticatedUser, id: string): Promise<HomeSection> {
  assertPermission(actor, 'content.read');
  const doc = await repo.findHomeSectionById(id);
  if (!doc) throw notFoundError('Home section not found.');
  return toHomeSectionDto(doc);
}

export async function createHomeSection(actor: AuthenticatedUser, input: AdminCreateHomeSectionInput): Promise<HomeSection> {
  assertPermission(actor, 'content.write');
  const settings = parseSettingsForType(input.type, input.settings);
  const doc = await repo.createHomeSection({
    type: input.type,
    settings,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  contentEvents.publish('home.updated', {});
  return toHomeSectionDto(doc);
}

export async function updateHomeSection(actor: AuthenticatedUser, id: string, input: AdminUpdateHomeSectionInput): Promise<HomeSection> {
  assertPermission(actor, 'content.write');
  const existing = await repo.findHomeSectionById(id);
  if (!existing) throw notFoundError('Home section not found.');

  const nextType = input.type ?? existing.type;
  const settings = input.settings !== undefined ? parseSettingsForType(nextType, input.settings) : undefined;

  const doc = await repo.updateHomeSection(id, {
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(settings !== undefined ? { settings } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
  });
  if (!doc) throw notFoundError('Home section not found.');
  contentEvents.publish('home.updated', {});
  return toHomeSectionDto(doc);
}

export async function deleteHomeSection(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'content.write');
  const deleted = await repo.softDeleteHomeSection(id);
  if (!deleted) throw notFoundError('Home section not found.');
  contentEvents.publish('home.updated', {});
}

export async function reorderHomeSections(actor: AuthenticatedUser, orderedIds: readonly string[]): Promise<HomeSection[]> {
  assertPermission(actor, 'content.write');
  await repo.reorderHomeSections(orderedIds);
  contentEvents.publish('home.updated', {});
  const docs = await repo.listHomeSections();
  return docs.map(toHomeSectionDto);
}

/** plan.md §9.2-style public endpoint (new for `content`): `GET
 *  /content/home` — published, in-window sections only, in `sortOrder`. */
export async function listPublicHomeSections(): Promise<PublicHomeSection[]> {
  const docs = await repo.listPublishedHomeSections(new Date());
  return docs.map(toPublicHomeSectionDto);
}
