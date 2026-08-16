'use client';

import { formatMoney } from '@lulwah/utils';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { PLACEHOLDER_PRODUCTS } from '../../../lib/placeholder-misc';
import type { PlaceholderProductRow } from '../../../lib/placeholder-misc';

/**
 * plan.md §11.1 Products — structural shell only (table + inline
 * quick-edit + CSV import are noted in the plan but out of scope for this
 * skeleton; depth in this workstream goes to Orders per the task brief).
 * Reuses the same generic `DataTable` the Orders screen uses, proving it
 * isn't Orders-specific.
 */
const COLUMNS: DataTableColumn<PlaceholderProductRow>[] = [
  { id: 'title', header: 'Title', cell: (p) => p.title },
  { id: 'brand', header: 'Brand', cell: (p) => p.brand },
  { id: 'articleCode', header: 'Article code', cell: (p) => p.articleCode },
  { id: 'stitchingType', header: 'Stitching', cell: (p) => p.stitchingType.replace(/_/g, ' ') },
  { id: 'price', header: 'Price', align: 'right', cell: (p) => formatMoney(p.priceFils, 'en') },
  { id: 'stock', header: 'Stock', align: 'right', cell: (p) => p.stock },
  { id: 'status', header: 'Status', cell: (p) => p.status },
];

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Products" description={`${PLACEHOLDER_PRODUCTS.length} products`} />
      <DataTable columns={COLUMNS} rows={PLACEHOLDER_PRODUCTS} getRowId={(p) => p.id} />
    </div>
  );
}
