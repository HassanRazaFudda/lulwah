import { z } from 'zod';
import { ErrorEnvelope, ResponseMeta } from '@lulwah/contracts';

/**
 * plan.md §25.3 "apps/admin" — the only API-reachability env var this app
 * needs. `apps/api` is a separate, parallel workstream and doesn't exist in
 * this worktree yet, so every call through this client currently resolves
 * against a placeholder base URL and will fail with a network error until
 * that app ships — the point of this file is that the shape it speaks
 * (§9.1's envelope, §33's closed error-code enum) is already correct.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Thrown for both transport failures and `{ success: false }` responses,
 *  so every call site can catch one error type. `code` is the closed
 *  `ErrorCode` enum (plan.md §33) when the server answered; `'NETWORK_ERROR'`
 *  is this client's own placeholder for "never got a response at all". */
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Builds the envelope schema for one endpoint's `data` shape — plan.md
 *  §9.1: `{ success: true, data, meta }` on success. */
function successEnvelopeSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({ success: z.literal(true), data: dataSchema, meta: ResponseMeta.optional() });
}

/**
 * Typed fetch wrapper around the admin API. Every admin screen should go
 * through this rather than calling `fetch` directly — it is the one place
 * that knows the §9.1 envelope shape, sends credentials (the admin auth
 * cookie, §10.1), and turns a `{ success: false }` body into a typed
 * `ApiClientError` instead of a caller having to re-check `.success` every
 * time.
 *
 * `dataSchema` both validates the response and gives the return type — the
 * same pattern `packages/contracts` uses everywhere else (plan.md §6.1).
 */
export async function apiRequest<T>(
  path: string,
  dataSchema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    // Built up rather than a single literal with `body`/`signal` set to
    // `undefined` — `exactOptionalPropertyTypes` (plan.md §27.1) means
    // `RequestInit`'s optional fields reject an explicit `undefined`, so
    // absent values must be omitted from the object entirely.
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    if (options.signal) init.signal = options.signal;
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Network request failed';
    throw new ApiClientError('NETWORK_ERROR', message, 0);
  }

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = ErrorEnvelope.safeParse(json);
    if (parsedError.success) {
      throw new ApiClientError(parsedError.data.error.code, parsedError.data.error.message, response.status);
    }
    throw new ApiClientError('INTERNAL_ERROR', `Request failed with status ${response.status}`, response.status);
  }

  const parsed = successEnvelopeSchema(dataSchema).safeParse(json);
  if (!parsed.success) {
    throw new ApiClientError('INTERNAL_ERROR', 'Response did not match the expected shape', response.status);
  }
  return parsed.data.data;
}
