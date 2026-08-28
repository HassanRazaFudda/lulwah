import type { PublicHomeSection } from '@lulwah/contracts';
import { apiFetch } from './api-client';
import { PublicHomeResponse } from './content-schemas';

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
 * composition.
 */
export async function getHomeSections(): Promise<PublicHomeSection[]> {
  const { sections } = await apiFetch('/content/home', PublicHomeResponse);
  return [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
}
