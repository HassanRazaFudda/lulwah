import { z } from 'zod';
import { PublicHomeSection } from '@lulwah/contracts';

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
