import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * plan.md §16: `/` redirects on `Accept-Language`, choice persisted in a
 * cookie. `createMiddleware` handles both — it inspects the request's
 * `Accept-Language` header (and any existing locale cookie) to pick `en`
 * or `ar`, then issues the redirect and sets the cookie for next time.
 */
export default createMiddleware(routing);

export const config = {
  // Run on every path except Next internals, static files and API routes —
  // the BFF (`/api/bff/*`) is not locale-prefixed.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
