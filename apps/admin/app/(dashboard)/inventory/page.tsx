'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { InventoryItem } from '@lulwah/contracts';
import { cx } from '@lulwah/ui';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { useAdminProductsQuery } from '../../../lib/queries/products';
import { useAdminInventoryQuery } from '../../../lib/queries/inventory';

/**
 * plan.md §11.1 Inventory screen, wired to the real `GET /admin/inventory`
 * (`inventory` module merged in this phase). `lowStock`/`outOfStock` are
 * genuine server-side filters here (unlike the Products screen's
 * stitching-type/brand filters — see `lib/queries/inventory.ts`'s doc
 * comment for why the two screens differ). `InventoryItem` itself carries
 * only `sku`/`productId`/`variantId` (plan.md §7.7 — no denormalised
 * product title), so the product column is a client-side join against the
 * product list, the same join style the Products screen uses for brand
 * names.
 */
export default function InventoryPage() {
  const router = useRouter();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [search, setSearch] = useState('');

  const { data: items, isLoading } = useAdminInventoryQuery({
    lowStock: lowStockOnly || undefined,
    outOfStock: outOfStockOnly || undefined,
    search: search.trim() || undefined,
  });
  const { data: products } = useAdminProductsQuery();
  const productById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const columns: DataTableColumn<InventoryItem>[] = [
    { id: 'sku', header: 'SKU', cell: (i) => <span className="font-semibold text-ink">{i.sku}</span> },
    {
      id: 'product',
      header: 'Product',
      cell: (i) => productById.get(i.productId)?.title ?? <span className="text-ink-70">Unknown product</span>,
    },
    {
      id: 'onHand',
      header: 'On hand',
      align: 'right',
      cell: (i) => <span className={cx('font-semibold', i.available <= 0 && 'text-danger')}>{i.onHand}</span>,
    },
    { id: 'available', header: 'Available', align: 'right', cell: (i) => i.available },
    { id: 'reserved', header: 'Reserved', align: 'right', cell: (i) => i.reserved },
    {
      id: 'threshold',
      header: 'Low-stock threshold',
      align: 'right',
      cell: (i) => (
        <span className={i.available > 0 && i.available <= i.lowStockThreshold ? 'font-semibold text-warning' : undefined}>
          {i.lowStockThreshold}
        </span>
      ),
    },
    { id: 'backorder', header: 'Backorder', cell: (i) => (i.allowBackorder ? 'Allowed' : '—') },
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Inventory" description={`${items?.length ?? 0} variant${items?.length === 1 ? '' : 's'}`} />

      <div className="flex flex-wrap items-center gap-16">
        <input
          type="search"
          placeholder="Search SKU…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-[40px] min-w-[200px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        />
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => {
              setLowStockOnly(event.target.checked);
              if (event.target.checked) setOutOfStockOnly(false);
            }}
          />
          Low stock only
        </label>
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input
            type="checkbox"
            checked={outOfStockOnly}
            onChange={(event) => {
              setOutOfStockOnly(event.target.checked);
              if (event.target.checked) setLowStockOnly(false);
            }}
          />
          Out of stock only
        </label>
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
          rows={items ?? []}
          getRowId={(i) => i.variantId}
          onRowClick={(i) => router.push(`/inventory/${i.variantId}`)}
          emptyMessage="No inventory items match these filters."
        />
      )}
    </div>
  );
}
