'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order, OrderStatus } from '@lulwah/contracts';
import { formatDate, formatMoney } from '@lulwah/utils';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn, DataTableSort } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { StatusFlagPill } from '../../../components/StatusFlagPill';
import { ALL_ORDER_STATUSES, ORDER_STATUS_META } from '../../../lib/order-status';
import { useAdminOrdersQuery } from '../../../lib/queries';

type SortAccessor = (order: Order) => string | number;

/** One accessor per sortable column — plugged into `DataTable`'s generic
 *  `onSortChange(columnId)` callback rather than baking sort logic into
 *  the table component itself. */
const SORT_ACCESSORS: Record<string, SortAccessor> = {
  date: (order) => order.placedAt.getTime(),
  total: (order) => order.grandTotalFils,
};

function applyFilters(orders: Order[], search: string, status: OrderStatus | 'all'): Order[] {
  const query = search.trim().toLowerCase();
  return orders.filter((order) => {
    if (status !== 'all' && order.status !== status) return false;
    if (!query) return true;
    const customer = `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.toLowerCase();
    return order.orderNumber.toLowerCase().includes(query) || customer.includes(query);
  });
}

function applySort(orders: Order[], sort: DataTableSort | null): Order[] {
  if (!sort) return orders;
  const accessor = SORT_ACCESSORS[sort.columnId];
  if (!accessor) return orders;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...orders].sort((a, b) => (accessor(a) < accessor(b) ? -1 : accessor(a) > accessor(b) ? 1 : 0) * direction);
}

/**
 * The headline screen (plan.md §11.1 Orders + §8.7, "the feature the brief
 * calls out explicitly"). Columns match the plan's list exactly: order #,
 * date, customer, emirate, items, total, payment method, payment status,
 * status flag pill, tags. Search + status filter and click-to-sort on
 * date/total give it real interactive structure, not just a static table;
 * saved filters, bulk actions and CSV export (also in §11.1) are noted as
 * follow-ups rather than built, per the task's "sortable/filterable
 * structure at least" scope.
 */
export default function OrdersPage() {
  const router = useRouter();
  const { data: orders, isLoading } = useAdminOrdersQuery();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: 'date', direction: 'desc' });

  const visibleOrders = useMemo(() => {
    const filtered = applyFilters(orders ?? [], search, statusFilter);
    return applySort(filtered, sort);
  }, [orders, search, statusFilter, sort]);

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
    { id: 'paymentStatus', header: 'Payment status', cell: (o) => o.paymentStatus },
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
          placeholder="Search order # or customer…"
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
