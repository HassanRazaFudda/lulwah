import { cx } from '@lulwah/ui';

export interface StatTileProps {
  label: string;
  value: string;
  deltaPct: number;
}

/** plan.md §11.1 Dashboard: "revenue, orders, AOV, conversion rate... with
 *  sparkline trends vs previous period." No sparkline chart in this
 *  skeleton (structure over polish, per the task brief) — the signed delta
 *  carries the same "vs previous period" information at a glance. */
export function StatTile({ label, value, deltaPct }: StatTileProps) {
  const isPositive = deltaPct >= 0;
  return (
    <div className="border border-line bg-paper p-16">
      <p className="text-label font-semibold uppercase tracking-label text-ink-70">{label}</p>
      <p className="mt-8 text-heading-2 font-semibold tabular-nums text-ink">{value}</p>
      <p className={cx('mt-4 text-body-sm tabular-nums', isPositive ? 'text-success' : 'text-danger')}>
        {isPositive ? '+' : ''}
        {deltaPct.toFixed(1)}% vs previous period
      </p>
    </div>
  );
}
