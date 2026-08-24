'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Product, ProductStatus, StitchingType } from '@lulwah/contracts';
import { StitchingType as StitchingTypeEnum } from '@lulwah/contracts';
import { formatMoney } from '@lulwah/utils';
import { Button } from '@lulwah/ui';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn, DataTableSort } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { ProductStatusPill } from '../../../components/ProductStatusPill';
import { Skeleton } from '../../../components/Skeleton';
import { useAdminBrandsQuery } from '../../../lib/queries/catalog-refs';
import { useAdminProductsQuery } from '../../../lib/queries/products';

/**
 * plan.md §11.1 Products screen: image thumb, title, brand, article code,
 * stitching type, price, compare-at, stock, status — wired to the real
 * `GET /admin/products` (catalog module merged in this phase). Filters
 * mirror the storefront's facets (stitching type, brand, status).
 *
 * `status` is a genuine server-side filter (`adminListProducts` applies it
 * — see `product.service.ts`); `stitchingType`/brand are applied
 * client-side over the one fetched page, because a live check against the
 * real API (see `lib/queries/products.ts`'s doc comment) confirmed
 * `AdminListProductsQuery`'s `stitchingType`/`brand`/`category` params are
 * accepted but never actually applied server-side in this phase — the same
 * fetch-all-then-filter-in-memory shape `OrdersPage` already uses for its
 * own search/status filters, not a new pattern.
 */

type SortAccessor = (product: Product) => string | number;

const SORT_ACCESSORS: Record<string, SortAccessor> = {
  title: (p) => p.title,
  price: (p) => p.basePriceFils,
  stock: (p) => p.totalStock,
  updatedAt: (p) => new Date(p.updatedAt).getTime(),
};

function applySort(products: Product[], sort: DataTableSort | null): Product[] {
  if (!sort) return products;
  const accessor = SORT_ACCESSORS[sort.columnId];
  if (!accessor) return products;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...products].sort((a, b) => (accessor(a) < accessor(b) ? -1 : accessor(a) > accessor(b) ? 1 : 0) * direction);
}

function primaryImageUrl(product: Product): string | null {
  const primary = product.media.find((m) => m.isPrimary) ?? product.media[0];
  return primary?.url ?? null;
}

function priceRangeLabel(product: Product): string {
  const { minFils, maxFils } = product.priceRange;
  if (minFils === maxFils) return formatMoney(minFils, 'en');
  return `${formatMoney(minFils, 'en')} – ${formatMoney(maxFils, 'en')}`;
}

export default function ProductsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all');
  const [stitchingFilter, setStitchingFilter] = useState<StitchingType | 'all'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: 'updatedAt', direction: 'desc' });

  const { data: products, isLoading } = useAdminProductsQuery({ status: statusFilter === 'all' ? undefined : statusFilter });
  const { data: brands } = useAdminBrandsQuery();
  const brandNameById = useMemo(() => new Map((brands ?? []).map((b) => [b.id, b.name])), [brands]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = (products ?? []).filter((p) => {
      if (stitchingFilter !== 'all' && p.stitchingType !== stitchingFilter) return false;
      if (brandFilter !== 'all' && p.brandId !== brandFilter) return false;
      if (!query) return true;
      return (
        p.title.toLowerCase().includes(query) ||
        p.articleCode.toLowerCase().includes(query) ||
        (brandNameById.get(p.brandId) ?? '').toLowerCase().includes(query)
      );
    });
    return applySort(filtered, sort);
  }, [products, search, stitchingFilter, brandFilter, sort, brandNameById]);

  const handleSortChange = (columnId: string) => {
    setSort((current) => {
      if (current?.columnId !== columnId) return { columnId, direction: 'desc' };
      return { columnId, direction: current.direction === 'desc' ? 'asc' : 'desc' };
    });
  };

  const columns: DataTableColumn<Product>[] = [
    {
      id: 'image',
      header: '',
      cell: (p) => {
        const url = primaryImageUrl(p);
        return url ? (
          // A plain <img>, not next/image — the admin console has no
          // imgproxy loader wired up (plan.md §8.3), so next/image's
          // default loader would just fail against these pasted-URL images.
          <img src={url} alt="" className="h-[40px] w-[40px] object-cover" />
        ) : (
          <div className="h-[40px] w-[40px] bg-pearl" />
        );
      },
    },
    { id: 'title', header: 'Title', sortable: true, cell: (p) => <span className="font-semibold text-ink">{p.title}</span> },
    { id: 'brand', header: 'Brand', cell: (p) => brandNameById.get(p.brandId) ?? '—' },
    { id: 'articleCode', header: 'Article code', cell: (p) => p.articleCode },
    { id: 'stitchingType', header: 'Stitching', cell: (p) => p.stitchingType.replace(/_/g, ' ') },
    { id: 'price', header: 'Price', sortable: true, align: 'right', cell: (p) => priceRangeLabel(p) },
    {
      id: 'compareAt',
      header: 'Compare-at',
      align: 'right',
      cell: (p) => (p.compareAtPriceFils ? formatMoney(p.compareAtPriceFils, 'en') : '—'),
    },
    {
      id: 'stock',
      header: 'Stock',
      sortable: true,
      align: 'right',
      cell: (p) => <span className={p.totalStock === 0 ? 'font-semibold text-danger' : undefined}>{p.totalStock}</span>,
    },
    { id: 'status', header: 'Status', cell: (p) => <ProductStatusPill status={p.status} size="sm" /> },
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title="Products"
        description={`${visibleProducts.length} product${visibleProducts.length === 1 ? '' : 's'}`}
        actions={
          <Button asChild>
            <Link href="/products/new">New product</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-8">
        <input
          type="search"
          placeholder="Search title, article code, brand…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-[40px] min-w-[240px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as ProductStatus | 'all')}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          <option value="all">All statuses</option>
          {(['draft', 'scheduled', 'active', 'archived'] satisfies ProductStatus[]).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by stitching type"
          value={stitchingFilter}
          onChange={(event) => setStitchingFilter(event.target.value as StitchingType | 'all')}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          <option value="all">All stitching types</option>
          {StitchingTypeEnum.options.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by brand"
          value={brandFilter}
          onChange={(event) => setBrandFilter(event.target.value)}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          <option value="all">All brands</option>
          {(brands ?? []).map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
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
          rows={visibleProducts}
          getRowId={(p) => p.id}
          sort={sort}
          onSortChange={handleSortChange}
          onRowClick={(p) => router.push(`/products/${p.id}`)}
          emptyMessage="No products match these filters."
        />
      )}
    </div>
  );
}
