'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Discount, DiscountMode, DiscountStatus, DiscountType } from '@lulwah/contracts';
import { DiscountMode as DiscountModeEnum, DiscountStatus as DiscountStatusEnum } from '@lulwah/contracts';
import { formatMoney } from '@lulwah/utils';
import { Button } from '@lulwah/ui';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn, DataTableSort } from '../../../components/DataTable';
import { DiscountStatusPill } from '../../../components/DiscountStatusPill';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { pushToast } from '../../../lib/stores/toast-store';
import { useAdminDiscountsQuery, useToggleDiscountMutation } from '../../../lib/queries/discounts';

/**
 * plan.md §11.1 Discounts screen: "List with status, usage vs limit,
 * revenue attributed." Real data from `GET /admin/discounts`
 * (`apps/api/src/modules/pricing/`, merged to `master` — read in full
 * before writing this, not assumed) replaces the old
 * `PLACEHOLDER_DISCOUNTS` array this file used to render.
 *
 * **"Revenue attributed" is deliberately NOT a column here.** Read
 * `discount.model.ts`, `discount.repository.ts`, and `pricing.service.ts`
 * in full: there is no revenue field on `Discount` anywhere, and nothing in
 * `pricing` joins against `orders` to compute one — `usage.usedCount` (a
 * plain redemption counter `order.service.ts` increments on confirmation,
 * see `docs/implemented-plan.md` §4.6.1) is the only real consumption
 * signal this module has. Showing a "Revenue attributed" column would mean
 * fabricating a number with nothing behind it, which this screen does not
 * do — usage vs limit is real and shown; revenue is not, and is omitted.
 *
 * `status`/`mode`/`search` are genuine server-side query params
 * (`AdminListDiscountsQuery`, verified against `discount.repository.ts
 * #listDiscounts`) — forwarded for real, same as `queries/orders.ts`'s
 * status/paymentStatus/search precedent, not client-side filtered.
 */

type SortAccessor = (d: Discount) => string | number;
const SORT_ACCESSORS: Record<string, SortAccessor> = {
  name: (d) => d.name,
  priority: (d) => d.priority,
  used: (d) => d.usage.usedCount,
  updatedAt: (d) => new Date(d.updatedAt).getTime(),
};

function applySort(discounts: Discount[], sort: DataTableSort | null): Discount[] {
  if (!sort) return discounts;
  const accessor = SORT_ACCESSORS[sort.columnId];
  if (!accessor) return discounts;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...discounts].sort((a, b) => (accessor(a) < accessor(b) ? -1 : accessor(a) > accessor(b) ? 1 : 0) * direction);
}

const TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Percentage',
  fixed_amount: 'Fixed amount',
  free_shipping: 'Free shipping',
  buy_x_get_y: 'Buy X get Y',
  tiered: 'Tiered',
  bundle: 'Bundle',
};

function valueLabel(d: Discount): string {
  switch (d.type) {
    case 'percentage':
      return `${d.value}%`;
    case 'fixed_amount':
    case 'bundle':
      return formatMoney(d.value, 'en');
    case 'free_shipping':
      return '—';
    case 'tiered':
      return `${d.tiers?.length ?? 0} tier${d.tiers?.length === 1 ? '' : 's'}`;
    case 'buy_x_get_y':
      return d.buyXGetY ? `Buy ${d.buyXGetY.buyQty} get ${d.buyXGetY.getQty}` : '—';
  }
}

export default function DiscountsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DiscountStatus | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<DiscountMode | 'all'>('all');
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: 'updatedAt', direction: 'desc' });

  const { data: discounts, isLoading } = useAdminDiscountsQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    mode: modeFilter === 'all' ? undefined : modeFilter,
    search: search.trim() || undefined,
  });
  const toggleDiscount = useToggleDiscountMutation();

  const visibleDiscounts = useMemo(() => applySort(discounts ?? [], sort), [discounts, sort]);

  const handleSortChange = (columnId: string) => {
    setSort((current) => {
      if (current?.columnId !== columnId) return { columnId, direction: 'desc' };
      return { columnId, direction: current.direction === 'desc' ? 'asc' : 'desc' };
    });
  };

  const handleToggle = (d: Discount) => {
    toggleDiscount.mutate(d.id, {
      onError: () => pushToast('error', `Couldn't change "${d.name}"'s status. Please try again.`),
    });
  };

  const columns: DataTableColumn<Discount>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (d) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{d.name}</span>
          {d.code ? <span className="text-body-sm text-ink-70">{d.code}</span> : null}
        </div>
      ),
    },
    { id: 'mode', header: 'Mode', cell: (d) => (d.mode === 'automatic' ? 'Automatic' : 'Code') },
    { id: 'type', header: 'Type', cell: (d) => TYPE_LABELS[d.type] },
    { id: 'value', header: 'Value', align: 'right', cell: (d) => valueLabel(d) },
    { id: 'status', header: 'Status', cell: (d) => <DiscountStatusPill status={d.status} size="sm" /> },
    {
      id: 'used',
      header: 'Usage / limit',
      sortable: true,
      align: 'right',
      cell: (d) => `${d.usage.usedCount} / ${d.usage.limitTotal ?? '∞'}`,
    },
    { id: 'stackable', header: 'Stackable', align: 'center', cell: (d) => (d.stackable ? 'Yes' : 'No') },
    { id: 'priority', header: 'Priority', sortable: true, align: 'right', cell: (d) => d.priority },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (d) => (
        <Button
          type="button"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(d);
          }}
          disabled={toggleDiscount.isPending}
        >
          {d.status === 'active' ? 'Disable' : 'Activate'}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title="Discounts"
        description={`${visibleDiscounts.length} discount${visibleDiscounts.length === 1 ? '' : 's'}. Usage vs limit is real; per-discount revenue attributed isn't tracked by the API (no field exists for it), so it's not shown here`}
        actions={
          <Button asChild>
            <Link href="/discounts/new">New discount</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-8">
        <input
          type="search"
          placeholder="Search name or code…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-[40px] min-w-[240px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as DiscountStatus | 'all')}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          <option value="all">All statuses</option>
          {DiscountStatusEnum.options.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by mode"
          value={modeFilter}
          onChange={(event) => setModeFilter(event.target.value as DiscountMode | 'all')}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          <option value="all">All modes</option>
          {DiscountModeEnum.options.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[40px]" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={visibleDiscounts}
          getRowId={(d) => d.id}
          sort={sort}
          onSortChange={handleSortChange}
          onRowClick={(d) => router.push(`/discounts/${d.id}`)}
          emptyMessage="No discounts match these filters."
        />
      )}
    </div>
  );
}
