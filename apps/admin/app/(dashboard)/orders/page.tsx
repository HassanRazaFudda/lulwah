'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order, OrderStatus, PaymentStatus } from '@lulwah/contracts';
import { formatDate, formatMoney } from '@lulwah/utils';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn, DataTableSort } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { StatusFlagPill } from '../../../components/StatusFlagPill';
import { ALL_ORDER_STATUSES, ORDER_STATUS_META } from '../../../lib/order-status';
import { useAdminOrdersQuery } from '../../../lib/queries/orders';

type SortAccessor = (order: Order) => string | number;

/** One accessor per sortable column — plugged into `DataTable`'s generic
 *  `onSortChange(columnId)` callback rather than baking sort logic into
 *  the table component itself. `AdminListOrdersQuery` (order.dto.ts) has
 *  no `sort` param and `order.repository.ts#adminListOrders` always sorts
 *  `createdAt: -1` server-side, so this reorders only the single fetched
 *  page (see `useAdminOrdersQuery`'s own doc comment) — the same
 *  within-the-page sort this screen always had. */
const SORT_ACCESSORS: Record<string, SortAccessor> = {
  date: (order) => order.placedAt.getTime(),
  total: (order) => order.grandTotalFils,
};

const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed'];

function applySort(orders: Order[], sort: DataTableSort | null): Order[] {
  if (!sort) return orders;
  const accessor = SORT_ACCESSORS[sort.columnId];
  if (!accessor) return orders;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...orders].sort((a, b) => (accessor(a) < accessor(b) ? -1 : accessor(a) > accessor(b) ? 1 : 0) * direction);
}

function isOrderStatus(value: string | null): value is OrderStatus {
  return value !== null && (ALL_ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * The headline screen (plan.md §11.1 Orders + §8.7, "the feature the brief
 * calls out explicitly"). Columns match the plan's list exactly: order #,
 * date, customer, emirate, items, total, payment method, payment status,
 * status flag pill, tags. Now backed by the real `GET /admin/orders`
 * (`order` module, merged this phase — `docs/implemented-plan.md` §4.6)
 * instead of the hand-written placeholder array this screen used before:
 * status, payment status, and search are real server-side query params
 * (see `lib/queries/orders.ts`'s doc comment on exactly what
 * `AdminListOrdersQuery` does and doesn't support), not a client-side
 * fetch-all-then-filter compromise like the Products screen's documented
 * one (`docs/implemented-plan.md` §6.3).
 *
 * The status filter's initial value reads `?status=` from the URL (via a
 * mount-time effect against `window.location.search`, not `next/navigation`'s
 * `useSearchParams()` — that hook requires a `<Suspense>` boundary around
 * any Client Component that calls it or `next build` fails outright; since
 * this whole app is already client-rendered/`noindex` with nothing to
 * statically prerender here, reading the URL directly after mount gets the
 * same result without that ceremony) so the dashboard's "Orders needing
 * action" links (`/orders?status=pending_payment` etc. —
 * `app/(dashboard)/page.tsx`) actually land on a pre-filtered table instead
 * of silently doing nothing.
 */
export default function OrdersPage() {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: 'date', direction: 'desc' });

  // Only ever applied once, right after mount — a deliberate one-shot
  // deep-link read, not a two-way URL sync (plan.md §11.1 doesn't ask for
  // the latter, and this screen has no other query-param state to keep in
  // sync with it).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('status');
    if (isOrderStatus(fromUrl)) setStatusFilter(fromUrl);
  }, []);

  const { data: orders, isLoading } = useAdminOrdersQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    paymentStatus: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
    search: search.trim() || undefined,
  });

  const visibleOrders = useMemo(() => applySort(orders ?? [], sort), [orders, sort]);

  const handleSortChange = (columnId: string) => {
    setSort((current) => {
      if (current?.columnId !== columnId) return { columnId, direction: 'desc' };
      return { columnId, direction: current.direction === 'desc' ? 'asc' : 'desc' };
    });
  };

  const columns: DataTableColumn<Order>[] = [
    { id: 'orderNumber', header: 'Order #', cell: (o) => <span className="font-semibold text-ink">{o.orderNumber}</span> },
    { id: 'date', header: 'Date', sortable: true, cell: (o) => formatDate(o.placedAt, 'en') },
    { id: 'customer', header: 'Customer', cell: (o) => `${o.shippingAddress.firstName} ${o.shippingAddress.lastName}` },
    { id: 'emirate', header: 'Emirate', cell: (o) => o.shippingAddress.emirate.replace(/_/g, ' ') },
    { id: 'items', header: 'Items', align: 'right', cell: (o) => o.items.reduce((n, i) => n + i.quantity, 0) },
    { id: 'total', header: 'Total', sortable: true, align: 'right', cell: (o) => formatMoney(o.grandTotalFils, 'en') },
    { id: 'paymentMethod', header: 'Payment', cell: (o) => o.payment.method.replace(/_/g, ' ') },
    { id: 'paymentStatus', header: 'Payment status', cell: (o) => o.paymentStatus.replace(/_/g, ' ') },
    { id: 'status', header: 'Status', cell: (o) => <StatusFlagPill status={o.status} size="sm" /> },
    {
      id: 'tags',
      header: 'Tags',
      cell: (o) =>
        o.tags.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {o.tags.map((tag) => (
              <span key={tag} className="rounded-sm bg-pearl px-8 py-4 text-[10px] uppercase tracking-label text-ink-70">
                {tag}
              </span>
            ))}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Orders" description={`${visibleOrders.length} order${visibleOrders.length === 1 ? '' : 's'}`} />

      <div className="flex flex-wrap items-center gap-8">
        <input
          type="search"
          placeholder="Search order #, email or phone…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-[40px] min-w-[240px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          <option value="all">All statuses</option>
          {ALL_ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_META[status].labelEn}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by payment status"
          value={paymentStatusFilter}
          onChange={(event) => setPaymentStatusFilter(event.target.value as PaymentStatus | 'all')}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          <option value="all">All payment statuses</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[40px]" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={visibleOrders}
          getRowId={(o) => o.id}
          sort={sort}
          onSortChange={handleSortChange}
          onRowClick={(o) => router.push(`/orders/${o.id}`)}
          emptyMessage="No orders match these filters."
        />
      )}
    </div>
  );
}
