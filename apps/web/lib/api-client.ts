import { apiEnvelope, type ErrorCode } from '@lulwah/contracts';
import type { z } from 'zod';

/**
 * Typed fetch wrapper around the §9.1 response envelope — every endpoint
 * this eventually calls returns `{ success: true, data, meta } | { success:
 * false, error, requestId }`, so callers get back either a parsed, typed
 * `data` payload or a thrown `ApiError` with the real error code, never a
 * raw `Response` to re-parse by hand.
 *
 * plan.md §5.2: the storefront never calls the API directly from the
 * browser for authenticated work — Server Components and Route Handlers
 * (`app/api/bff/*`) call it over `API_INTERNAL_URL` (the Docker-network
 * address, unreachable from outside the VPS), while genuinely public,
 * client-side calls (e.g. a client component re-fetching availability) go
 * over `NEXT_PUBLIC_API_URL`. Both env vars are read here even though
 * neither points at a live `apps/api` yet — that wiring is a separate
 * workstream.
 */
export class ApiError extends Error {
  readonly code: ErrorCode | 'UNKNOWN_RESPONSE_SHAPE';
  readonly httpStatus: number;

  constructor(code: ErrorCode | 'UNKNOWN_RESPONSE_SHAPE', message: string, httpStatus: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Resolves the base URL for the environment the code is running in.
 * `typeof window === 'undefined'` is the standard Next.js signal for
 * "this is executing on the server" (a Server Component, Route Handler or
 * Server Action) — the browser can never resolve a Docker-network
 * hostname, so client code must always fall back to the public URL.
 */
function resolveBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? '';
}

export interface ApiFetchInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Fetches `path` from the API, validates the envelope, and returns the
 * typed `data` payload. `dataSchema` is one of the shared Zod schemas from
 * `@lulwah/contracts` (e.g. `Product`, `Cart`) — the same schema the API
 * validates its own response against, so the storefront and API can never
 * silently drift out of sync (plan.md §6.1).
 */
export async function apiFetch<T>(path: string, dataSchema: z.ZodType<T>, init: ApiFetchInit = {}): Promise<T> {
  const baseUrl = resolveBaseUrl();
  const { body, headers, ...rest } = init;

  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...headers },
    // `body` is only spread in when present — under `exactOptionalPropertyTypes`, `RequestInit.body` can't be assigned an explicit `undefined`.
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const json: unknown = await response.json().catch(() => null);
  const parsed = apiEnvelope(dataSchema).safeParse(json);

  if (!parsed.success) {
    throw new ApiError('UNKNOWN_RESPONSE_SHAPE', `Unexpected response shape from ${path}`, response.status);
  }
  if (!parsed.data.success) {
    throw new ApiError(parsed.data.error.code, parsed.data.error.message, response.status);
  }
  return parsed.data.data;
}
