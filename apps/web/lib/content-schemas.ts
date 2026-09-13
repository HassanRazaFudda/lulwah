import { z } from 'zod';
import { PublicHomeSection, PublicJournalPost, PublicLookbook } from '@lulwah/contracts';

/**
 * Response-shape schema for the `content` module's public endpoint
 * (`apps/api/src/modules/content/home-section.dto.ts#PublicHomeResponse`).
 * `PublicHomeSection` itself is a real `@lulwah/contracts` export (`content.ts`
 * is a shared contract, not a module-local DTO) — only the `{ sections: [...] }`
 * envelope around it is declared API-side, so it's re-declared here from the
 * shared primitive, same "module-local envelope, shared entity type"
 * convention `catalog-schemas.ts` already establishes for `/products` etc.
 */
export const PublicHomeResponse = z.object({ sections: z.array(PublicHomeSection) });
export type PublicHomeResponse = z.infer<typeof PublicHomeResponse>;

// --- GET /content/lookbooks, GET /content/lookbooks/:slug ------------------
// Envelope shapes mirror `apps/api/.../content/lookbook.dto.ts`'s own
// `PublicLookbook`-wrapping response types exactly (`{ lookbooks }` for the
// list, `{ lookbook }` for one) — `PublicLookbook` itself is the real shared
// `@lulwah/contracts` entity, same split as `PublicHomeResponse` above.
export const PublicLookbookListResponse = z.object({ lookbooks: z.array(PublicLookbook) });
export type PublicLookbookListResponse = z.infer<typeof PublicLookbookListResponse>;

export const PublicLookbookDetailResponse = z.object({ lookbook: PublicLookbook });
export type PublicLookbookDetailResponse = z.infer<typeof PublicLookbookDetailResponse>;

// --- GET /content/journal, GET /content/journal/:slug -----------------------
// Mirrors `apps/api/.../content/journal.dto.ts#PublicJournalPostListResponse`/
// `PublicJournalPostResponse` — the same envelope is reused for both the
// paginated listing and the `?slugs=` batch-resolution call (the API's own
// `listPublic` controller returns `{ posts }` either way, only `meta` differs).
export const PublicJournalPostListResponse = z.object({ posts: z.array(PublicJournalPost) });
export type PublicJournalPostListResponse = z.infer<typeof PublicJournalPostListResponse>;

export const PublicJournalPostDetailResponse = z.object({ post: PublicJournalPost });
export type PublicJournalPostDetailResponse = z.infer<typeof PublicJournalPostDetailResponse>;
