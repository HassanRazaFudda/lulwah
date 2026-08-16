import type { Logger } from 'pino';

/**
 * Cross-cutting `Request` fields every route can rely on. Auth-specific
 * fields (`req.user`) are augmented separately in
 * `modules/identity/identity.policy.ts` — that stays module-owned so
 * `shared/` never has to import an identity type (plan.md §5.3).
 */
declare module 'express-serve-static-core' {
  interface Request {
    /** Echoes `x-request-id` in, or a generated one — plan.md §9.8. */
    id: string;
    /** `logger` child with `requestId` bound. */
    log: Logger;
  }
}
