import { useQuery } from '@tanstack/react-query';
import { DASHBOARD_STATS } from './placeholder-dashboard';

/**
 * Dashboard-stats data-fetching — plan.md §11.1's "Today/7d/30d: revenue,
 * orders, AOV, conversion rate" stat tiles. No `reports`/analytics API
 * module exists yet (`docs/implemented-plan.md` §4: only `identity`,
 * `catalog`, `inventory`, `cart`, `pricing`, `checkout`, `order`, `payment`
 * are built), so these four numbers stay hand-written placeholder data —
 * unlike Orders (see `lib/queries/orders.ts`), there is no real endpoint to
 * swap in here yet. Kept as a `useQuery` (rather than a bare constant) so
 * `DashboardPage`'s skeleton-loading state still has something to key off
 * of, consistent with plan.md §11.2 rule 1.
 *
 * The Orders/Inventory-backed panels below the stat tiles on that same page
 * ("Orders needing action", "Low stock") are wired to the real
 * `useAdminOrdersQuery`/`useAdminInventoryQuery` hooks directly in
 * `app/(dashboard)/page.tsx` — real data doesn't belong behind this
 * placeholder-only hook.
 */
function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const DASHBOARD_STATS_QUERY_KEY = ['admin', 'dashboard', 'stats'] as const;

export function useDashboardStatsQuery() {
  return useQuery({ queryKey: DASHBOARD_STATS_QUERY_KEY, queryFn: () => delay(DASHBOARD_STATS) });
}
