'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminCustomerProfile } from '@lulwah/contracts';
import { formatDate, formatMoney, formatUaePhone } from '@lulwah/utils';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { useAdminCustomersQuery } from '../../../lib/queries/customers';
import type { CustomerSort } from '../../../lib/queries/customers';

const SORT_OPTIONS: { value: CustomerSort; label: string }[] = [
  { value: 'createdAt', label: 'Newest accounts' },
  { value: 'spend', label: 'Highest spend' },
  { value: 'lastOrder', label: 'Most recent order' },
];

function customerName(c: AdminCustomerProfile): string {
  const name = `${c.firstName} ${c.lastName}`.trim();
  return name || c.email || 'Unnamed customer';
}

function marketingSummary(c: AdminCustomerProfile): string {
  const channels: string[] = [];
  if (c.marketing.email) channels.push('Email');
  if (c.marketing.sms) channels.push('SMS');
  if (c.marketing.whatsapp) channels.push('WhatsApp');
  return channels.length > 0 ? channels.join(', ') : 'Opted out';
}

/**
 * plan.md §11.1 Customers — "List with orders, spend, last order, tags,
 * marketing consent." Replaces the old `PLACEHOLDER_CUSTOMERS` shell with
 * real `GET /admin/customers` data (`customer` module, merged this phase —
 * see `docs/implemented-plan.md`). `search`/`tag`/`marketingConsent`/`sort`
 * are all genuinely server-side query params here — see
 * `lib/queries/customers.ts`'s doc comment for exactly how that was
 * verified, and why this screen (unlike Orders/Products) doesn't need a
 * client-side filtering fallback for anything in this bar.
 */
export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [marketingConsent, setMarketingConsent] = useState<'all' | 'true' | 'false'>('all');
  const [sort, setSort] = useState<CustomerSort>('createdAt');

  const { data: customers, isLoading } = useAdminCustomersQuery({
    search: search.trim() || undefined,
    tag: tag.trim() || undefined,
    marketingConsent: marketingConsent === 'all' ? undefined : marketingConsent === 'true',
    sort,
  });

  const rows = customers ?? [];

  const columns: DataTableColumn<AdminCustomerProfile>[] = [
    { id: 'name', header: 'Name', cell: (c) => <span className="font-semibold text-ink">{customerName(c)}</span> },
    { id: 'email', header: 'Email', cell: (c) => c.email ?? '—' },
    { id: 'phone', header: 'Phone', cell: (c) => (c.phone ? formatUaePhone(c.phone.number) : '—') },
    { id: 'orders', header: 'Orders', align: 'right', cell: (c) => c.stats.orderCount },
    { id: 'spend', header: 'Total spent', align: 'right', cell: (c) => formatMoney(c.stats.totalSpentFils, 'en') },
    {
      id: 'lastOrder',
      header: 'Last order',
      cell: (c) => (c.stats.lastOrderAt ? formatDate(c.stats.lastOrderAt, 'en') : '—'),
    },
    {
      id: 'tags',
      header: 'Tags',
      cell: (c) =>
        c.tags.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {c.tags.map((t) => (
              <span key={t} className="rounded-sm bg-pearl px-8 py-4 text-[10px] uppercase tracking-label text-ink-70">
                {t}
              </span>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    { id: 'marketing', header: 'Marketing consent', cell: (c) => marketingSummary(c) },
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Customers" description={`${rows.length} customer${rows.length === 1 ? '' : 's'}`} />

      <div className="flex flex-wrap items-center gap-8">
        <input
          type="search"
          placeholder="Search name, email or phone…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-[40px] min-w-[240px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        />
        <input
          type="text"
          placeholder="Filter by tag (exact)…"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          className="h-[40px] w-[200px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        />
        <select
          aria-label="Filter by marketing consent"
          value={marketingConsent}
          onChange={(event) => setMarketingConsent(event.target.value as 'all' | 'true' | 'false')}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          <option value="all">Any marketing consent</option>
          <option value="true">Opted in (any channel)</option>
          <option value="false">Opted out (all channels)</option>
        </select>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as CustomerSort)}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
          rows={rows}
          getRowId={(c) => c.id}
          onRowClick={(c) => router.push(`/customers/${c.id}`)}
          emptyMessage="No customers match these filters."
        />
      )}
    </div>
  );
}
