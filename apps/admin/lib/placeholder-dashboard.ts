/** plan.md §11.1 Dashboard — "Today/7d/30d/custom: revenue, orders, AOV,
 *  conversion rate, units. Sparkline trends vs previous period." Static
 *  placeholder numbers; the structure (current value + prior-period delta)
 *  is what a real `/admin/reports/sales` response would also carry. No
 *  `reports` API module exists yet (see `lib/queries.ts`'s doc comment), so
 *  unlike this same dashboard's "Orders needing action"/"Low stock" panels
 *  (real `order`/`inventory` data, wired directly in
 *  `app/(dashboard)/page.tsx`) these four numbers stay placeholder. */
export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  deltaPct: number;
}

export const DASHBOARD_STATS: DashboardStat[] = [
  { id: 'revenue', label: 'Revenue (7d)', value: 'AED 84,320', deltaPct: 12.4 },
  { id: 'orders', label: 'Orders (7d)', value: '312', deltaPct: 8.1 },
  { id: 'aov', label: 'Avg. order value', value: 'AED 270.30', deltaPct: -2.6 },
  { id: 'conversion', label: 'Conversion rate', value: '2.9%', deltaPct: 0.3 },
];
