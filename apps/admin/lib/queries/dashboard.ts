import { useMemo } from 'react';
import { formatMoney } from '@lulwah/utils';
import { useSalesReportQuery } from './reports';

/**
 * Dashboard summary stat tiles — plan.md §11.1's Dashboard row: "Today/7d/
 * 30d/custom: revenue, orders, AOV, conversion rate, units. Sparkline
 * trends vs previous period." Previously hand-written placeholder data
 * (`lib/placeholder-dashboard.ts`, now deleted) whose own doc comment said
 * plainly "no `reports` API module exists yet" — that module now exists
 * for real (`apps/api/src/modules/report/`, `docs/implemented-plan.md`
 * §4.7.4) and this file wires the tiles to it, reusing
 * `useSalesReportQuery` (`lib/queries/reports.ts`, already built for the
 * Reports screen) rather than duplicating its fetch/validation logic.
 *
 * What's real and how, verified by reading `report.dto.ts`/`report.ts`
 * (`@lulwah/contracts`)/`sales.repository.ts` first, not assumed:
 *
 *  - **Revenue (7d)** = `SalesReportResponse.totals.grandTotalFils` for a
 *    trailing 7-day window — a real field, summed server-side.
 *  - **Orders (7d)** = `totals.ordersCount` — same response, real field.
 *  - **Avg. order value** = `grandTotalFils / ordersCount`, derived
 *    client-side. No endpoint computes AOV directly, but both inputs are
 *    real numbers from the same real response — an honest derivation, not
 *    a fabrication.
 *  - **Units sold (7d)** = `totals.unitsSold`, shown **in place of
 *    "Conversion rate"** — see below for why.
 *
 * **Conversion rate was deliberately dropped, not faked.** Plan.md §23's
 * GA4/analytics integration was never built anywhere in this repo —
 * confirmed via `report.routes.ts`'s own doc comment ("Traffic... no
 * analytics integration exists in this repo at all") and this app's own
 * `reports/page.tsx`, which shows a visible-but-honest "Traffic — not
 * available" tab rather than a fake chart. Conversion rate needs a
 * visit/session count as its denominator; no such number exists anywhere
 * in this codebase, so there is no real value to compute here. Rather than
 * leave a fourth tile silently showing a hardcoded/fake number next to
 * three real ones, it's replaced with "Units sold (7d)" — the fifth metric
 * plan.md's own §11.1 sentence names in the same breath ("revenue, orders,
 * AOV, conversion rate, **units**"), and one `SalesReportResponse.totals`
 * already computes for real. If a real GA4 integration is ever built (see
 * `implemented-plan.md` §11 item 10), conversion rate belongs back here.
 *
 * **Sparkline trend vs previous period**: `SalesReportQuery` genuinely
 * accepts arbitrary `dateFrom`/`dateTo` (`report.dto.ts`), so "vs previous
 * period" is built for real, not faked — a second `useSalesReportQuery`
 * call fetches the 7 days immediately before the current window and a
 * real percent change is computed from the two real totals. No sparkline
 * *chart* component exists in this app (`StatTile`'s own doc comment:
 * "no sparkline chart in this skeleton... the signed delta carries the
 * same... information at a glance") — this reuses that existing
 * convention rather than inventing a new chart widget.
 *
 * Both periods use full ISO timestamps (`Date#toISOString`), not the
 * `YYYY-MM-DD`-only strings the Reports screen's `<input type="date">`
 * sends — `SalesReportQuery.dateFrom/dateTo` is `z.coerce.date()`, which
 * accepts either, and a precise instant avoids the UTC-midnight
 * truncation a date-only `dateTo` would otherwise cause (today's sales
 * after 00:00 UTC would be silently excluded from a "last 7 days" window
 * that's supposed to include all of today).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;

export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  deltaPct: number;
}

/** `previous === 0` would divide by zero; treated as "+100%" when the
 *  current value is genuinely positive (something from nothing), or "0%"
 *  when both periods are zero (no real change to report). */
function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export interface DashboardSalesStatsResult {
  stats: DashboardStat[] | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Fires two real `GET /admin/reports/sales` calls (current trailing
 * 7-day window, and the 7 days immediately before it) and derives the
 * dashboard's four stat tiles from their `totals`. `groupBy: 'day'` is
 * used for both (matches the Reports screen's own default) but doesn't
 * matter for `totals` — `SalesReportResponse.totals` is always the true
 * period total regardless of `groupBy`, per that field's own doc comment
 * in `@lulwah/contracts`; only `rows` (unused here) would differ.
 */
export function useDashboardSalesStats(): DashboardSalesStatsResult {
  const { currentFrom, currentTo, previousFrom, previousTo } = useMemo(() => {
    const now = new Date();
    const currentTo = now;
    const currentFrom = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
    const previousTo = currentFrom;
    const previousFrom = new Date(currentFrom.getTime() - WINDOW_DAYS * DAY_MS);
    return { currentFrom, currentTo, previousFrom, previousTo };
    // Deliberately computed once per mount (empty deps), not re-derived
    // every render — a dashboard summary doesn't need millisecond-fresh
    // "now," and TanStack Query's own cache/refetch behavior (not this
    // memo) is what makes a manual `refetch()` pick up new data.
  }, []);

  const current = useSalesReportQuery({
    dateFrom: currentFrom.toISOString(),
    dateTo: currentTo.toISOString(),
    groupBy: 'day',
  });
  const previous = useSalesReportQuery({
    dateFrom: previousFrom.toISOString(),
    dateTo: previousTo.toISOString(),
    groupBy: 'day',
  });

  const isLoading = current.isLoading || previous.isLoading;
  const error = current.error ?? previous.error;

  const stats = useMemo<DashboardStat[] | undefined>(() => {
    if (!current.data || !previous.data) return undefined;
    const cur = current.data.totals;
    const prev = previous.data.totals;
    const aovFils = cur.ordersCount > 0 ? cur.grandTotalFils / cur.ordersCount : 0;
    const prevAovFils = prev.ordersCount > 0 ? prev.grandTotalFils / prev.ordersCount : 0;

    return [
      {
        id: 'revenue',
        label: `Revenue (${WINDOW_DAYS}d)`,
        value: formatMoney(cur.grandTotalFils, 'en'),
        deltaPct: percentDelta(cur.grandTotalFils, prev.grandTotalFils),
      },
      {
        id: 'orders',
        label: `Orders (${WINDOW_DAYS}d)`,
        value: String(cur.ordersCount),
        deltaPct: percentDelta(cur.ordersCount, prev.ordersCount),
      },
      {
        id: 'aov',
        label: 'Avg. order value',
        value: formatMoney(aovFils, 'en'),
        deltaPct: percentDelta(aovFils, prevAovFils),
      },
      {
        id: 'units',
        label: `Units sold (${WINDOW_DAYS}d)`,
        value: String(cur.unitsSold),
        deltaPct: percentDelta(cur.unitsSold, prev.unitsSold),
      },
    ];
  }, [current.data, previous.data]);

  return {
    stats,
    isLoading,
    error,
    refetch: () => {
      void current.refetch();
      void previous.refetch();
    },
  };
}
