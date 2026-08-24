import type { User } from '@lulwah/contracts';

/**
 * Minimal admin session store — holds the short-lived access token
 * (`requireAuth()` in `apps/api`'s `identity.policy.ts` verifies an
 * `Authorization: Bearer <token>` header; it does not accept a cookie for
 * this) so `api-client.ts` can attach it to every admin request.
 *
 * This did not exist before this task: `api-client.ts` sent `credentials:
 * 'include'` (for the httpOnly refresh-token cookie) but never attached the
 * access token itself, so every RBAC-gated `/admin/*` call — the products
 * and inventory endpoints this task wires up — would 401 regardless of how
 * correct the rest of the request was. Fixing that is in scope here because
 * without it neither screen this task builds can ever succeed against the
 * real API.
 *
 * Kept deliberately small: in-memory for the life of the tab, mirrored to
 * `sessionStorage` only so a page refresh during development doesn't force
 * a re-login. No silent refresh-token rotation, no cross-tab sync, no
 * redirect-on-401 guard — a real session layer (plan.md §10.1's "8-hour
 * session, IP-change re-auth") is out of this task's scope; this is just
 * enough plumbing for the product/inventory screens to authenticate.
 */

const STORAGE_KEY = 'lulwah_admin_session';

interface StoredSession {
  accessToken: string;
  user: Pick<User, 'id' | 'email' | 'role' | 'firstName' | 'lastName'>;
}

let currentSession: StoredSession | null = null;

function readFromStorage(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/** Call once on first use per tab — picks up a session stored by an earlier
 *  page in this tab so a client-side navigation doesn't look logged-out. */
function ensureLoaded(): void {
  if (currentSession !== null) return;
  currentSession = readFromStorage();
}

export function setSession(session: StoredSession): void {
  currentSession = session;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

export function clearSession(): void {
  currentSession = null;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function getAccessToken(): string | null {
  ensureLoaded();
  return currentSession?.accessToken ?? null;
}

export function getSessionUser(): StoredSession['user'] | null {
  ensureLoaded();
  return currentSession?.user ?? null;
}
