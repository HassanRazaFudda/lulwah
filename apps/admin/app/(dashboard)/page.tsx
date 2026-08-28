'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AccessDenied } from '../../components/AccessDenied';
import { PageHeader } from '../../components/PageHeader';
import { Panel } from '../../components/Panel';
import { Skeleton } from '../../components/Skeleton';
import { StatTile } from '../../components/StatTile';
import { isForbiddenError } from '../../lib/api-client';
import { useDashboardSalesStats } from '../../lib/queries/dashboard';
import { useAdminInventoryQuery } from '../../lib/queries/inventory';
import { useAdminOrdersQuery } from '../../lib/queries/orders';
import { useAdminProductsQuery } from '../../lib/queries/products';

/** The four "needs action" statuses from plan.md §11.1's Dashboard row,
 *  each backed by a real, separately-filtered `GET /admin/orders?status=`
 *  call (see `lib/queries/orders.ts`) rather than the old placeholder
 *  array's `.filter()` over a hand-written order list. `limit` on that
 *  endpoint caps at 100 (`AdminListOrdersQuery`), so a count here is exact
 *  up to 100 orders in a given status — comfortably enough for this app's
 *  current live-order volume; a true unbounded count would need the
 *  response `meta.total` this app's `apiRequest` wrapper doesn't currently
 *  surface (see that file's doc comment). */
const ACTION_STATUSES = [
  { status: 'pending_payment' as const, label: 'Pending payment' },
  { status: 'ready_to_ship' as const, label: 'Ready to ship, not yet shipped' },
  { status: 'stitching' as const, label: 'With tailor (stitching)' },
  { status: 'returned' as const, label: 'Return requests to inspect' },
];

/**
 * plan.md §11.1 Dashboard row. The four stat tiles (revenue/orders/AOV/
 * units) are real now too, as of this pass — `useDashboardSalesStats`
 * (`lib/queries/dashboard.ts`) computes them from two real
 * `GET /admin/reports/sales` calls now that the `report` module exists
 * (see that file's own doc comment for exactly how each tile is derived,
 * and why "Conversion rate" was replaced with "Units sold" rather than
 * faked — no analytics/GA4 integration exists anywhere in this repo to
 * supply a real visit count). "Orders needing action" and "Low stock" were
 * already real: the `order` and `inventory` modules both merged in an
 * earlier phase, and both list endpoints already had exactly the
 * server-side filters (`status`, `lowStock`) this panel needs.
 */
export default function DashboardPage() {
  const { stats: statsData, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardSalesStats();

  // Hooks called unconditionally, one per fixed status — not a loop over a
  // dynamic list, so this stays within the rules of hooks.
  const pendingPayment = useAdminOrdersQuery({ status: 'pending_payment' });
  const readyToShip = useAdminOrdersQuery({ status: 'ready_to_ship' });
  const stitching = useAdminOrdersQuery({ status: 'stitching' });
  const returned = useAdminOrdersQuery({ status: 'returned' });
  const actionQueries = [pendingPayment, readyToShip, stitching, returned];
  const actionItemsLoading = actionQueries.some((q) => q.isLoading);

  const actionItems = ACTION_STATUSES.map((entry, index) => ({
    id: entry.status,
    label: entry.label,
    count: actionQueries[index]?.data?.length ?? 0,
    filterHref: `/orders?status=${entry.status}`,
  }));

  const { data: lowStockItems, isLoading: lowStockLoading } = useAdminInventoryQuery({ lowStock: true });
  const { data: products } = useAdminProductsQuery();
  const productById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const lowStockRows = (lowStockItems ?? []).slice(0, 6);

  return (
    <div className="flex flex-col gap-24">
      <PageHeader title="Dashboard" description="Trailing 7 days, vs the 7 days before — no date-range picker on this dashboard yet." />

      <div className="grid grid-cols-2 gap-16 lg:grid-cols-4">
        {statsError ? (
          <div className="col-span-2 lg:col-span-4">
            {isForbiddenError(statsError) ? (
              <AccessDenied permission="reports.read" description="Dashboard sales stats are restricted." />
            ) : (
              <div className="flex flex-col items-start gap-8 border border-line bg-paper p-16">
                <p className="text-body-sm text-danger">
                  {statsError instanceof Error ? statsError.message : 'Failed to load dashboard stats.'}
                </p>
                <button
                  type="button"
                  onClick={() => refetchStats()}
                  className="text-body-sm font-semibold text-zamurrad underline underline-offset-4"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ) : statsLoading || !statsData ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[96px]" />)
        ) : (
          statsData.map((stat) => <StatTile key={stat.id} {...stat} />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <Panel title="Orders needing action">
          {actionItemsLoading ? (
            <Skeleton className="h-[120px]" />
          ) : (
            <ul className="flex flex-col gap-8">
              {actionItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.filterHref}
                    className="flex items-center justify-between border-b border-line py-8 text-body-sm text-ink hover:text-zamurrad"
                  >
                    <span>{item.label}</span>
                    <span className="font-semibold tabular-nums">{item.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Low stock">
          {lowStockLoading ? (
            <Skeleton className="h-[120px]" />
          ) : lowStockRows.length === 0 ? (
            <p className="text-body-sm text-ink-70">Nothing under its low-stock threshold right now.</p>
          ) : (
            <ul className="flex flex-col gap-8">
              {lowStockRows.map((item) => (
                <li key={item.variantId} className="flex items-center justify-between border-b border-line py-8 text-body-sm">
                  <span className="text-ink">
                    {productById.get(item.productId)?.title ?? 'Unknown product'} — {item.sku}
                  </span>
                  <span className={item.onHand === 0 ? 'font-semibold text-danger' : 'font-semibold text-warning'}>
                    {item.onHand} / {item.lowStockThreshold}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
