import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Settings } from '@lulwah/contracts';
import type { CodSettings, ShippingSettings, StoreDetails } from '@lulwah/contracts';
import { apiRequest } from '../api-client';

/**
 * Settings data-fetching layer — `GET/PATCH /admin/settings` (plan.md
 * §9.7/§11.1, `apps/api/src/modules/settings/settings.routes.ts`). Same
 * `use*Query`/`use*Mutation` + optimistic-with-rollback shape
 * `queries/orders.ts`/`queries/products.ts` already establish.
 *
 * A genuine singleton — no list, no id, one document — so there is exactly
 * one query key and no per-id variant, unlike every other file in this
 * directory.
 *
 * `AdminUpdateSettingsInput` (`settings.dto.ts`) replaces each top-level
 * nested object **whole** when provided (no deep-partial merge) but leaves
 * every other top-level key untouched if omitted — confirmed by reading
 * `settings.dto.ts`'s own doc comment, not assumed. That's what lets this
 * one mutation serve two different UI shapes: an immediate single-field
 * PATCH for the feature-flag/maintenance-mode toggles (plan.md §11.2 rule
 * 2 — genuine optimistic toggles), and a batched multi-field PATCH from the
 * "Save changes" form for storeDetails/shipping/cod/taxRate (same
 * `ProductEditor`-style local-draft-then-save pattern `lib/product-
 * draft.ts` already uses, since those are multi-field forms, not toggles).
 *
 * There is deliberately no field here for `paymentGateway` — the DTO has
 * none either (Zod strips unknown keys), so there is no code path through
 * this file that could ever submit a raw payment-gateway key (plan.md §19).
 */

const SettingsResponse = z.object({ settings: Settings });
const SETTINGS_QUERY_KEY = ['admin', 'settings'] as const;

export function useAdminSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => apiRequest('/admin/settings', SettingsResponse).then((r) => r.settings),
  });
}

export interface UpdateSettingsVars {
  storeDetails?: StoreDetails;
  shipping?: ShippingSettings;
  cod?: CodSettings;
  taxRate?: number;
  featureFlags?: Record<string, boolean>;
  maintenanceMode?: boolean;
}

interface UpdateSettingsContext {
  previous: Settings | undefined;
}

/**
 * plan.md §11.2 rule 2: "Optimistic updates on toggles and inline edits,
 * with rollback + toast on failure." `onMutate` shallow-merges `vars` onto
 * the cached singleton (safe because every field here is either a whole-
 * object replacement or a top-level primitive — never a partial patch of a
 * nested object), `onError` restores the exact previous snapshot, and
 * `onSettled` always refetches so a real server-computed field
 * (`updatedAt`/`updatedByUserId`) is never left stale after a successful
 * write.
 */
export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation<Settings, Error, UpdateSettingsVars, UpdateSettingsContext>({
    mutationFn: (vars) =>
      apiRequest('/admin/settings', SettingsResponse, { method: 'PATCH', body: vars }).then((r) => r.settings),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEY });
      const previous = queryClient.getQueryData<Settings>(SETTINGS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<Settings>(SETTINGS_QUERY_KEY, { ...previous, ...vars });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SETTINGS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
  });
}
