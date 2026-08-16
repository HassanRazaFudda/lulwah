import { ADMIN_ORDERS } from './placeholder-orders';

/** plan.md §11.1 Dashboard — "Today/7d/30d/custom: revenue, orders, AOV,
 *  conversion rate, units. Sparkline trends vs previous period." Static
 *  placeholder numbers; the structure (current value + prior-period delta)
 *  is what a real `/admin/reports/sales` response would also carry. */
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

export interface ActionItem {
  id: string;
  label: string;
  count: number;
  filterHref: string;
}

/** "Orders needing action" — plan.md §11.1. Counts derived from the same
 *  placeholder order set so the number here and what `/orders` actually
 *  shows never disagree, even as a demo. */
export const ORDERS_NEEDING_ACTION: ActionItem[] = [
  {
    id: 'pending_payment',
    label: 'Pending payment',
    count: ADMIN_ORDERS.filter((o) => o.status === 'pending_payment').length,
    filterHref: '/orders?status=pending_payment',
  },
  {
    id: 'ready_to_ship',
    label: 'Ready to ship, not yet shipped',
    count: ADMIN_ORDERS.filter((o) => o.status === 'ready_to_ship').length,
    filterHref: '/orders?status=ready_to_ship',
  },
  {
    id: 'stitching',
    label: 'With tailor (stitching)',
    count: ADMIN_ORDERS.filter((o) => o.status === 'stitching').length,
    filterHref: '/orders?status=stitching',
  },
  {
    id: 'returned',
    label: 'Return requests to inspect',
    count: ADMIN_ORDERS.filter((o) => o.status === 'returned').length,
    filterHref: '/orders?status=returned',
  },
];

export interface LowStockItem {
  sku: string;
  title: string;
  onHand: number;
  threshold: number;
}

export const LOW_STOCK_ITEMS: LowStockItem[] = [
  { sku: 'LF-0104-S-MAROON', title: 'Zari Formal 3-Piece — S / Maroon', onHand: 1, threshold: 5 },
  { sku: 'LF-0092-M-BLACK', title: 'Velvet Winter Shawl — M / Black', onHand: 2, threshold: 5 },
  { sku: 'LF-0071-L-GOLD', title: 'Bridal Silk Dupatta — L / Gold', onHand: 0, threshold: 3 },
  { sku: 'LF-0038-XS-FEROZI', title: 'Lawn Everyday 3-Piece — XS / Ferozi', onHand: 3, threshold: 8 },
];
