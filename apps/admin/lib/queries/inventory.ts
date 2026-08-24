import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { InventoryItem, StockMovement, StockMovementType } from '@lulwah/contracts';
import { apiRequest } from '../api-client';
import { buildQueryString } from './query-utils';

/**
 * Inventory data-fetching layer — `GET /admin/inventory`,
 * `POST /admin/inventory/:variantId/adjust`, `GET
 * /admin/inventory/:variantId/movements` (plan.md §9.7,
 * `apps/api/src/modules/inventory/inventory.routes.ts`). Unlike the admin
 * products list (see `queries/products.ts`'s doc comment), `lowStock`/
 * `outOfStock`/`search` on this endpoint ARE genuinely applied server-side
 * (`inventory.repository.ts#listInventory` builds a real Mongo filter from
 * them) — verified by reading that file, not assumed — so these are sent
 * as real query params rather than filtered client-side.
 */

const AdminInventoryListResponse = z.object({ items: z.array(InventoryItem) });
const AdjustStockResponse = z.object({ item: InventoryItem, movement: StockMovement });
const ListMovementsResponse = z.object({ movements: z.array(StockMovement) });

const INVENTORY_QUERY_KEY = ['admin', 'inventory'] as const;
const movementsQueryKey = (variantId: string) => ['admin', 'inventory', variantId, 'movements'] as const;

export interface AdminInventoryFilter {
  lowStock?: boolean | undefined;
  outOfStock?: boolean | undefined;
  search?: string | undefined;
}

export function useAdminInventoryQuery(filter: AdminInventoryFilter = {}) {
  return useQuery({
    queryKey: [...INVENTORY_QUERY_KEY, filter],
    queryFn: () =>
      apiRequest(
        `/admin/inventory${buildQueryString({ lowStock: filter.lowStock, outOfStock: filter.outOfStock, search: filter.search, limit: 100 })}`,
        AdminInventoryListResponse,
      ).then((r) => r.items),
  });
}

export interface AdjustStockVars {
  variantId: string;
  quantity: number;
  type: StockMovementType;
  reason: string;
}

/**
 * `AdjustStockInput` (`@lulwah/contracts`' `inventory.ts`) requires a
 * non-empty `reason` and a non-zero `quantity` — the server 400s a request
 * missing either. The mutation still sends whatever the caller passes (it
 * doesn't silently drop a bad request); the UI's own validation is what
 * stops the request from ever being fired with an empty reason (see
 * `InventoryAdjustForm`), matching plan.md §10.2's "never in the UI alone"
 * pairing the other way round — client-side checks here are a UX nicety on
 * top of the server's real enforcement, not a replacement for it.
 */
export function useAdjustStockMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, quantity, type, reason }: AdjustStockVars) =>
      apiRequest(`/admin/inventory/${variantId}/adjust`, AdjustStockResponse, {
        method: 'POST',
        body: { quantity, type, reason },
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: movementsQueryKey(vars.variantId) });
      // A stock adjustment changes the parent product's denormalised
      // `totalStock`/`inStock` (plan.md §7.5) — invalidate the product
      // editor's Inventory tab and the Products list too, so both reflect
      // the new number without a manual refresh.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'product'] });
    },
  });
}

export function useStockMovementsQuery(variantId: string) {
  return useQuery({
    queryKey: movementsQueryKey(variantId),
    queryFn: () => apiRequest(`/admin/inventory/${variantId}/movements?limit=50`, ListMovementsResponse).then((r) => r.movements),
    enabled: variantId.length > 0,
  });
}
