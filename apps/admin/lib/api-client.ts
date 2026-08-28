import { z } from 'zod';
import { ErrorEnvelope, ResponseMeta } from '@lulwah/contracts';
import { getAccessToken } from './auth-session';

/**
 * plan.md §25.3 "apps/admin" — the only API-reachability env var this app
 * needs. `apps/api` shipped its catalog/inventory modules in this phase
 * (plan.md §28 P1) — this client now talks to a real, running API, not a
 * placeholder base URL.
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
    // `requireAuth()` (apps/api's identity.policy.ts) only recognises an
    // `Authorization: Bearer <token>` header — the `credentials: 'include'`
    // cookie below carries the httpOnly refresh token, not the access
    // token, so RBAC-gated `/admin/*` routes need this attached explicitly.
    const accessToken = getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;

    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
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

/** True when `error` is an `ApiClientError` the server raised specifically
 *  because the authenticated user lacks a required permission — plan.md
 *  §10.2's `AUTH_FORBIDDEN` is reused for both "not authenticated" (401)
 *  and "authenticated but missing the permission" (403), so `httpStatus`
 *  is what actually distinguishes the two here, not `code` alone. Screens
 *  gated by a specific permission (Reports' `reports.read`, Audit log's
 *  `audit.read`) use this to render a real "you don't have access" state
 *  instead of a generic error dump. */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiClientError && error.httpStatus === 403;
}

/**
 * Same contract as `apiRequest`, but also returns the §9.1 envelope's
 * `meta` (page/limit/total/hasMore) — `apiRequest` itself discards `meta`,
 * which is fine for every existing caller (they all fetch one generous,
 * unpaginated-in-practice page, per `queries/orders.ts`'s/`queries/
 * inventory.ts`'s own doc comments), but the Audit log screen has no such
 * guarantee — admin mutating traffic can realistically exceed one page —
 * so it needs real `total`/`hasMore` to paginate against.
 */
export async function apiRequestWithMeta<T>(
  path: string,
  dataSchema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<{ data: T; meta: ResponseMeta | undefined }> {
  let response: Response;
  try {
    const accessToken = getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;

    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
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
  return { data: parsed.data.data, meta: parsed.data.meta };
}

export interface CsvDownloadResult {
  blob: Blob;
  filename: string;
}

const CONTENT_DISPOSITION_FILENAME_RE = /filename="([^"]*)"/;

/**
 * For the one admin surface that doesn't speak the §9.1 JSON envelope at
 * all: `report.controller.ts`'s `?format=csv` branch sends a raw
 * `text/csv` body with `Content-Disposition: attachment` directly (see
 * that file — confirmed by reading it, not assumed), so this is a
 * deliberately separate function rather than a mode of `apiRequest`,
 * which always expects and Zod-parses the JSON envelope. A non-2xx
 * response is still the normal JSON error envelope (the controller only
 * diverges from JSON on the success path), so the failure branch reuses
 * the same `ErrorEnvelope` parsing as `apiRequest`.
 */
export async function apiRequestCsv(path: string, fallbackFilename: string): Promise<CsvDownloadResult> {
  let response: Response;
  try {
    const accessToken = getAccessToken();
    const headers: Record<string, string> = {};
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET', headers, credentials: 'include' });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Network request failed';
    throw new ApiClientError('NETWORK_ERROR', message, 0);
  }

  if (!response.ok) {
    const json: unknown = await response.json().catch(() => null);
    const parsedError = ErrorEnvelope.safeParse(json);
    if (parsedError.success) {
      throw new ApiClientError(parsedError.data.error.code, parsedError.data.error.message, response.status);
    }
    throw new ApiClientError('INTERNAL_ERROR', `Request failed with status ${response.status}`, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition');
  const match = disposition ? CONTENT_DISPOSITION_FILENAME_RE.exec(disposition) : null;
  return { blob, filename: match?.[1] || fallbackFilename };
}
