'use client';

import Link from 'next/link';
import { PageHeader } from '../../components/PageHeader';
import { Panel } from '../../components/Panel';
import { Skeleton } from '../../components/Skeleton';
import { StatTile } from '../../components/StatTile';
import { useDashboardQuery } from '../../lib/queries';

/**
 * plan.md §11.1 Dashboard row. Static-shaped placeholder data (via
 * `lib/queries.ts`'s simulated fetch) — the point of this screen in the
 * skeleton is the layout structure (stat tiles / needs-action / low-stock),
 * not real analytics wiring, which is a separate reports/API workstream.
 */
export default function DashboardPage() {
  const { data, isLoading } = useDashboardQuery();

  return (
    <div className="flex flex-col gap-24">
      <PageHeader title="Dashboard" description="Today · 7d · 30d — placeholder period, no date picker in this skeleton." />

      <div className="grid grid-cols-2 gap-16 lg:grid-cols-4">
        {isLoading || !data
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[96px]" />)
          : data.stats.map((stat) => <StatTile key={stat.id} {...stat} />)}
      </div>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <Panel title="Orders needing action">
          {isLoading || !data ? (
            <Skeleton className="h-[120px]" />
          ) : (
            <ul className="flex flex-col gap-8">
              {data.actionItems.map((item) => (
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
          {isLoading || !data ? (
            <Skeleton className="h-[120px]" />
          ) : (
            <ul className="flex flex-col gap-8">
              {data.lowStock.map((item) => (
                <li key={item.sku} className="flex items-center justify-between border-b border-line py-8 text-body-sm">
                  <span className="text-ink">{item.title}</span>
                  <span className={item.onHand === 0 ? 'font-semibold text-danger' : 'font-semibold text-warning'}>
                    {item.onHand} / {item.threshold}
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
