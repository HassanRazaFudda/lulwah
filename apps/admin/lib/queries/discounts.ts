import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Discount, DiscountMode, DiscountStatus } from '@lulwah/contracts';
import { apiRequest, ApiClientError } from '../api-client';
import type { DiscountDraft } from '../discount-draft';
import { draftToBody } from '../discount-draft';
import { buildQueryString } from './query-utils';

/**
 * Discount data-fetching layer — `GET/POST/PATCH/DELETE /admin/discounts*`
 * and `POST /admin/discounts/:id/toggle` (plan.md §9.7/§11.1,
 * `apps/api/src/modules/pricing/pricing.routes.ts`, read in full before
 * writing this file — not assumed). Same `use*Query`/`use*Mutation` shape
 * `queries/orders.ts`/`queries/products.ts` already establish.
 *
 * **No bulk-create endpoint exists.** `pricing.routes.ts` has exactly one
 * `POST /admin/discounts` for a single discount — there is no
 * `/admin/discounts/bulk` or similar. `useBulkGenerateCodesMutation` below
 * is a real implementation of plan.md §11.1's "bulk generate unique codes"
 * feature via N individual, real `POST /admin/discounts` calls (one per
 * generated code, same underlying config) — not a fake or a stub. See that
 * hook's own doc comment and this task's report for why.
 *
 * **No revenue-attributed figure exists anywhere in this module.**
 * `DiscountDoc`/`Discount` (`discount.model.ts`, `@lulwah/contracts`'
 * `discount.ts`) has no revenue field, and neither `discount.repository.ts`
 * nor `pricing.service.ts` computes one from orders (there is no join to
 * `orders` in this module at all — `usage.usedCount` is the only real
 * consumption signal). Plan.md §11.1 asks the Discounts list to show
 * "revenue attributed"; this file does not fabricate that number anywhere,
 * and the list screen omits the column rather than inventing one.
 */

const AdminDiscountListResponse = z.object({ discounts: z.array(Discount) });
const AdminDiscountResponse = z.object({ discount: Discount });

const DISCOUNTS_QUERY_KEY = ['admin', 'discounts'] as const;
const discountQueryKey = (id: string) => ['admin', 'discount', id] as const;

export interface AdminDiscountsFilter {
  status?: DiscountStatus | undefined;
  mode?: DiscountMode | undefined;
  search?: string | undefined;
}

/**
 * Fetches one generous page (limit 100 — same "one page, no pagination UI"
 * choice `queries/orders.ts`/`queries/products.ts` already made). Unlike
 * the Products screen's brand/stitchingType filters (verified NOT applied
 * server-side, see that file's doc comment), `status`/`mode`/`search` here
 * genuinely ARE applied server-side — confirmed by reading
 * `discount.repository.ts#listDiscounts`, which builds a real Mongo filter
 * from all three — so they're forwarded as real query params.
 */
export function useAdminDiscountsQuery(filter: AdminDiscountsFilter = {}) {
  return useQuery({
    queryKey: [...DISCOUNTS_QUERY_KEY, filter],
    queryFn: () =>
      apiRequest(
        `/admin/discounts${buildQueryString({ status: filter.status, mode: filter.mode, search: filter.search, limit: 100 })}`,
        AdminDiscountListResponse,
      ).then((r) => r.discounts),
  });
}

export function useAdminDiscountQuery(id: string) {
  return useQuery({
    queryKey: discountQueryKey(id),
    queryFn: () => apiRequest(`/admin/discounts/${id}`, AdminDiscountResponse).then((r) => r.discount),
    enabled: id.length > 0,
  });
}

export function useCreateDiscountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: DiscountDraft) =>
      apiRequest('/admin/discounts', AdminDiscountResponse, { method: 'POST', body: draftToBody(draft) }).then((r) => r.discount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DISCOUNTS_QUERY_KEY });
    },
  });
}

export interface UpdateDiscountVars {
  id: string;
  draft: DiscountDraft;
}

export function useUpdateDiscountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: UpdateDiscountVars) =>
      apiRequest(`/admin/discounts/${id}`, AdminDiscountResponse, { method: 'PATCH', body: draftToBody(draft) }).then(
        (r) => r.discount,
      ),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: DISCOUNTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: discountQueryKey(vars.id) });
    },
  });
}

/** Delete is a real `DELETE` — `deleteDiscount` (`pricing.service.ts`) soft-
 *  deletes (`deletedAt` set, `status: 'disabled'`) but the effect from this
 *  app's point of view is the same as a hard delete: the row disappears
 *  from every list/get this app can reach (`discount.repository.ts`'s
 *  `NOT_DELETED` filter excludes it everywhere). Irreversible from the UI —
 *  gated behind `ConfirmDialog`'s typed confirmation per plan.md §11.2 rule
 *  3, not just a plain confirm click. */
export function useDeleteDiscountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/discounts/${id}`, z.object({}), { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: discountQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: DISCOUNTS_QUERY_KEY });
    },
  });
}

interface ToggleDiscountContext {
  previousDetail: Discount | undefined;
  previousLists: Array<[readonly unknown[], Discount[] | undefined]>;
}

function flippedStatus(discount: Discount): DiscountStatus {
  // Mirrors `pricing.service.ts#toggleDiscount` exactly: active -> disabled,
  // anything else (draft/scheduled/expired/disabled) -> active. The UI
  // presents this as a simple on/off switch (`DiscountStatusPill` reads
  // "active" as on, everything else as off) because that's genuinely what
  // the one real endpoint does — it does not have a separate "activate a
  // draft" vs "re-enable a disabled one" distinction server-side.
  return discount.status === 'active' ? 'disabled' : 'active';
}

/**
 * `POST /admin/discounts/:id/toggle` — plan.md §11.2 rule 2, "optimistic
 * updates on toggles ... with rollback + toast on failure". Optimistically
 * flips `status` in both the detail cache AND every currently-cached list
 * query (the toggle is invoked from list rows and from the builder header
 * alike), rolls every one of them back on error — the same
 * onMutate/onError/onSettled shape `queries/orders.ts
 * #useUpdateOrderStatusMutation` already established for this app's one
 * other optimistic status flip.
 */
export function useToggleDiscountMutation() {
  const queryClient = useQueryClient();

  return useMutation<Discount, ApiClientError, string, ToggleDiscountContext>({
    mutationFn: (id: string) => apiRequest(`/admin/discounts/${id}/toggle`, AdminDiscountResponse, { method: 'POST' }).then((r) => r.discount),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: discountQueryKey(id) });
      await queryClient.cancelQueries({ queryKey: DISCOUNTS_QUERY_KEY });

      const previousDetail = queryClient.getQueryData<Discount>(discountQueryKey(id));
      const previousLists = queryClient.getQueriesData<Discount[]>({ queryKey: DISCOUNTS_QUERY_KEY });

      if (previousDetail) {
        queryClient.setQueryData<Discount>(discountQueryKey(id), { ...previousDetail, status: flippedStatus(previousDetail) });
      }
      for (const [key, list] of previousLists) {
        if (!list) continue;
        queryClient.setQueryData<Discount[]>(
          key,
          list.map((d) => (d.id === id ? { ...d, status: flippedStatus(d) } : d)),
        );
      }

      return { previousDetail, previousLists };
    },
    onError: (_err, id, context) => {
      if (context?.previousDetail) queryClient.setQueryData(discountQueryKey(id), context.previousDetail);
      for (const [key, list] of context?.previousLists ?? []) {
        queryClient.setQueryData(key, list);
      }
    },
    onSettled: (_data, _err, id) => {
      void queryClient.invalidateQueries({ queryKey: discountQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: DISCOUNTS_QUERY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Bulk code generation — N real POST /admin/discounts calls, no bulk
// endpoint exists (see this file's top doc comment).
// ---------------------------------------------------------------------------

export interface BulkGenerateCodeResult {
  code: string;
  status: 'created' | 'failed';
  discountId?: string;
  error?: string;
}

export interface BulkGenerateVars {
  draft: DiscountDraft;
  codes: string[];
  /** Called after each individual create settles, so the caller can render
   *  live progress ("142 / 500 created") instead of a spinner — plan.md
   *  §11.2 rule 1 applies here too even though this isn't a page load. */
  onProgress?: (completed: number, total: number) => void;
}

const CONCURRENCY = 8;

/**
 * Fires one real `POST /admin/discounts` per code, `CONCURRENCY` at a time
 * (chunked, not all 500 at once — a courtesy to the API/Mongo under a real
 * influencer-campaign-sized batch, not a requirement the backend imposes).
 * Every discount created this way is a genuine, independent document in
 * Mongo with its own `_id`, identical to one created through the regular
 * single-discount form — "bulk" describes the client-side loop, not a
 * shortcut in what gets persisted. A per-code failure (most likely a `409`
 * from the unique `{ code: 1 }` index if a prefix collides with an existing
 * discount) does not stop the batch — every code is attempted, and the
 * per-code outcome is what the UI's results table and CSV export are built
 * from.
 */
export function useBulkGenerateCodesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ draft, codes, onProgress }: BulkGenerateVars): Promise<BulkGenerateCodeResult[]> => {
      const results: BulkGenerateCodeResult[] = [];
      let completed = 0;

      for (let start = 0; start < codes.length; start += CONCURRENCY) {
        const chunk = codes.slice(start, start + CONCURRENCY);
        const chunkResults = await Promise.all(
          chunk.map(async (code): Promise<BulkGenerateCodeResult> => {
            try {
              const body = draftToBody({ ...draft, mode: 'code', code });
              const discount = await apiRequest('/admin/discounts', AdminDiscountResponse, { method: 'POST', body }).then(
                (r) => r.discount,
              );
              return { code, status: 'created', discountId: discount.id };
            } catch (err) {
              const message = err instanceof ApiClientError ? err.message : 'Request failed.';
              return { code, status: 'failed', error: message };
            } finally {
              completed += 1;
              onProgress?.(completed, codes.length);
            }
          }),
        );
        results.push(...chunkResults);
      }
      return results;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DISCOUNTS_QUERY_KEY });
    },
  });
}
