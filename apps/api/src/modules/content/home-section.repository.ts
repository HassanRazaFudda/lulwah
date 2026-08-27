import type { PartialWithUndefined } from '../../shared/types.js';
import { HomeSectionModel } from './home-section.model.js';
import type { HomeSectionDoc, HomeSectionHydratedDoc } from './home-section.model.js';

/** The ONLY file allowed to touch `HomeSectionModel` (plan.md §5.4). */

export type CreateHomeSectionInput = Pick<HomeSectionDoc, 'type' | 'settings'> &
  Partial<Pick<HomeSectionDoc, 'sortOrder' | 'isActive' | 'startsAt' | 'endsAt'>>;

export type UpdateHomeSectionInput = PartialWithUndefined<CreateHomeSectionInput>;

const NOT_DELETED = { deletedAt: null };

export async function createHomeSection(input: CreateHomeSectionInput): Promise<HomeSectionHydratedDoc> {
  return HomeSectionModel.create(input);
}

export async function findHomeSectionById(id: string): Promise<HomeSectionHydratedDoc | null> {
  return HomeSectionModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function listHomeSections(): Promise<HomeSectionHydratedDoc[]> {
  return HomeSectionModel.find(NOT_DELETED).sort({ sortOrder: 1 }).exec();
}

/** `GET /content/home` — only sections currently in their active window,
 *  per plan.md §7.13's `isActive`/`startsAt`/`endsAt` fields. */
export async function listPublishedHomeSections(now: Date): Promise<HomeSectionHydratedDoc[]> {
  return HomeSectionModel.find({
    ...NOT_DELETED,
    isActive: true,
    $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }],
  })
    .sort({ sortOrder: 1 })
    .exec();
}

export async function updateHomeSection(id: string, input: UpdateHomeSectionInput): Promise<HomeSectionHydratedDoc | null> {
  return HomeSectionModel.findOneAndUpdate({ _id: id, ...NOT_DELETED }, input, { returnDocument: 'after' }).exec();
}

export async function softDeleteHomeSection(id: string): Promise<boolean> {
  const result = await HomeSectionModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date() }).exec();
  return result.modifiedCount > 0;
}

/** Bulk drag-and-drop reorder (plan.md §11.1: "drag-and-drop the ordered
 *  `home_sections`") — one round trip, `sortOrder` set to each id's index
 *  in the caller's order, rather than N individual `updateOne` calls. */
export async function reorderHomeSections(orderedIds: readonly string[]): Promise<void> {
  await HomeSectionModel.bulkWrite(
    orderedIds.map((id, index) => ({
      updateOne: { filter: { _id: id, ...NOT_DELETED }, update: { sortOrder: index } },
    })),
  );
}
