import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `home_sections` — plan.md §7.13/§15.2. `content`
 * owns this model (plan.md §5.3); only `home-section.repository.ts` may
 * import it (§5.4).
 *
 * `settings` is `Schema.Types.Mixed` — its real shape varies per `type`
 * (nine different settings schemas in `@lulwah/contracts`' `content.ts`).
 * The Zod DTO layer (`home-section.dto.ts`'s discriminated-union create
 * input, `home-section.service.ts`'s type-aware update validation) is the
 * actual enforcement point, matching this codebase's "framework-free
 * service layer" rule — Mongoose itself doesn't referee document shape.
 */

export type HomeSectionType =
  | 'hero'
  | 'collection_rail'
  | 'editorial_split'
  | 'brand_strip'
  | 'category_grid'
  | 'video_banner'
  | 'usp_bar'
  | 'journal_teaser'
  | 'newsletter';

export interface HomeSectionDoc {
  _id: Types.ObjectId;
  type: HomeSectionType;
  settings: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const homeSectionSchema = new Schema<HomeSectionDoc>(
  {
    type: {
      type: String,
      enum: ['hero', 'collection_rail', 'editorial_split', 'brand_strip', 'category_grid', 'video_banner', 'usp_bar', 'journal_teaser', 'newsletter'],
      required: true,
    },
    settings: { type: Schema.Types.Mixed, required: true, default: {} },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'home_sections' },
);

homeSectionSchema.index({ deletedAt: 1, sortOrder: 1 });
homeSectionSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

export type HomeSectionHydratedDoc = HydratedDocument<HomeSectionDoc>;
export const HomeSectionModel = model<HomeSectionDoc>('HomeSection', homeSectionSchema);
