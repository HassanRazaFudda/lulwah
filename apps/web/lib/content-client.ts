import type { PublicHomeSection, PublicJournalPost, PublicLookbook } from '@lulwah/contracts';
import { apiFetch, apiFetchWithMeta, isBuildTimeUnreachable } from './api-client';
import {
  PublicHomeResponse,
  PublicJournalPostDetailResponse,
  PublicJournalPostListResponse,
  PublicLookbookDetailResponse,
  PublicLookbookListResponse,
} from './content-schemas';

/**
 * Thin fetch function over `apiFetch` (matching `catalog-client.ts`'s
 * established convention exactly) for the real `content` module's public
 * home-sections endpoint (`GET /content/home` —
 * `apps/api/src/modules/content/content.routes.ts`).
 *
 * Returns the CMS-configured, in-active-window `home_sections` list. The
 * API already returns these in `sortOrder` (`home-section.repository.ts
 * #listPublishedHomeSections`); this re-sorts defensively so a future API
 * change to that ordering guarantee can't silently break the storefront's
 * section order without a visible test failure here.
 *
 * An empty array is a real, expected response — no content editor has
 * necessarily built a homepage yet (`docs/implemented-plan.md` §4.7.3/§6.8
 * both note this honestly). Callers must handle it; see
 * `app/[locale]/page.tsx`'s documented fallback to the fixed launch
 * composition. The same empty-array fallback also covers the build-time-
 * only case where no API is reachable at all — see `isBuildTimeUnreachable`'s
 * doc comment (api-client.ts) — since the home page's own `revalidate`
 * fetches real data again on the next real request/revalidation anyway.
 */
export async function getHomeSections(): Promise<PublicHomeSection[]> {
  try {
    const { sections } = await apiFetch('/content/home', PublicHomeResponse);
    return [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (err) {
    if (isBuildTimeUnreachable(err)) return [];
    throw err;
  }
}

/** Same "is this a real 404, not some other failure" check `catalog-client.ts`
 *  already establishes for `getProductBySlug`/`getBrandBySlug` — duplicated
 *  locally rather than imported, matching this codebase's existing
 *  per-client-file convention (`isNotFound` isn't exported from anywhere). */
function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'NOT_FOUND';
}

// ---------------------------------------------------------------------------
// Lookbooks — `GET /content/lookbooks[/:slug]` (`apps/api/.../content/
// lookbook.routes.ts`). Published only; the API 404s a draft/unknown slug.
// ---------------------------------------------------------------------------

/** List, already sorted `sortOrder` by the API (`lookbook.service.ts
 *  #listPublicLookbooks`) — no defensive client-side re-sort needed, unlike
 *  `getHomeSections`, since there's no separate ordering guarantee to drift
 *  from here (a single, dedicated endpoint, not a mixed-type list). */
export async function getLookbooks(): Promise<PublicLookbook[]> {
  try {
    const { lookbooks } = await apiFetch('/content/lookbooks', PublicLookbookListResponse);
    return lookbooks;
  } catch (err) {
    // Build-time-only fallback — see `getHomeSections`'s doc comment.
    if (isBuildTimeUnreachable(err)) return [];
    throw err;
  }
}

export async function getLookbookBySlug(slug: string): Promise<PublicLookbook | null> {
  try {
    const { lookbook } = await apiFetch(`/content/lookbooks/${encodeURIComponent(slug)}`, PublicLookbookDetailResponse);
    return lookbook;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Journal — `GET /content/journal[/:slug]` (`apps/api/.../content/
// journal.routes.ts`). Published only, newest-first, paginated; `slugs=`
// resolves specific posts in request order instead (see
// `getJournalPostsBySlugs` below) — the real `journal_teaser.postSlugs`
// resolution mechanism `journal.dto.ts#ListJournalPostsQuery`'s own doc
// comment describes.
// ---------------------------------------------------------------------------

export interface ListJournalPostsParams {
  page?: number;
  limit?: number;
}

export interface ListJournalPostsResult {
  posts: PublicJournalPost[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function getJournalPosts(params: ListJournalPostsParams = {}): Promise<ListJournalPostsResult> {
  try {
    const query = buildQueryString({ page: params.page, limit: params.limit });
    const { data, meta } = await apiFetchWithMeta(`/content/journal${query}`, PublicJournalPostListResponse);
    return {
      posts: data.posts,
      page: meta?.page ?? params.page ?? 1,
      limit: meta?.limit ?? params.limit ?? 20,
      total: meta?.total ?? data.posts.length,
      hasMore: meta?.hasMore ?? false,
    };
  } catch (err) {
    // Build-time-only fallback — see `getHomeSections`'s doc comment.
    if (isBuildTimeUnreachable(err)) {
      return { posts: [], page: params.page ?? 1, limit: params.limit ?? 20, total: 0, hasMore: false };
    }
    throw err;
  }
}

/** `slugs` resolve to real, published posts in the order given, silently
 *  dropping any unknown/draft slug — exactly `ListJournalPostsQuery`'s own
 *  documented behavior. Returns `[]` without a network call for an empty
 *  input rather than sending a meaningless `?slugs=` request. */
export async function getJournalPostsBySlugs(slugs: string[]): Promise<PublicJournalPost[]> {
  if (slugs.length === 0) return [];
  const { posts } = await apiFetch(
    `/content/journal?slugs=${encodeURIComponent(slugs.join(','))}`,
    PublicJournalPostListResponse,
  );
  return posts;
}

export async function getJournalPostBySlug(slug: string): Promise<PublicJournalPost | null> {
  try {
    const { post } = await apiFetch(`/content/journal/${encodeURIComponent(slug)}`, PublicJournalPostDetailResponse);
    return post;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}
