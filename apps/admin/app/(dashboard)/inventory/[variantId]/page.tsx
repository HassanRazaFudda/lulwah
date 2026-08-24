'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { StockMovement } from '@lulwah/contracts';
import { formatDateTime } from '@lulwah/utils';
import { InventoryAdjustForm } from '../../../../components/InventoryAdjustForm';
import { DataTable } from '../../../../components/DataTable';
import type { DataTableColumn } from '../../../../components/DataTable';
import { Panel } from '../../../../components/Panel';
import { PageHeader } from '../../../../components/PageHeader';
import { Skeleton } from '../../../../components/Skeleton';
import { useAdminInventoryQuery, useStockMovementsQuery } from '../../../../lib/queries/inventory';
import { useAdminProductQuery } from '../../../../lib/queries/products';

const MOVEMENT_COLUMNS: DataTableColumn<StockMovement>[] = [
  { id: 'date', header: 'Date', cell: (m) => formatDateTime(m.createdAt, 'en') },
  { id: 'type', header: 'Type', cell: (m) => m.type },
  {
    id: 'quantity',
    header: 'Quantity',
    align: 'right',
    cell: (m) => <span className={m.quantity < 0 ? 'text-danger' : 'text-success'}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>,
  },
  { id: 'before', header: 'Before', align: 'right', cell: (m) => m.before },
  { id: 'after', header: 'After', align: 'right', cell: (m) => m.after },
  { id: 'reason', header: 'Reason', cell: (m) => m.reason },
];

/**
 * One variant's inventory detail — plan.md §11.1's "movement history per
 * variant" ("the API exposes this — link to it"). There's no single-item
 * `GET /admin/inventory/:variantId` endpoint (only list + adjust +
 * movements — see `inventory.routes.ts`), so the item itself is found in
 * the already-fetched list query by `variantId`, the same
 * fetch-all-then-find-by-id shape `lib/queries.ts`'s `findAdminOrderById`
 * already uses for order detail.
 */
export default function InventoryDetailPage() {
  const params = useParams();
  const variantId = Array.isArray(params.variantId) ? (params.variantId[0] ?? '') : (params.variantId ?? '');

  const { data: items, isLoading: itemsLoading } = useAdminInventoryQuery();
  const item = items?.find((i) => i.variantId === variantId);

  const { data: productDetail } = useAdminProductQuery(item?.productId ?? '');
  const { data: movements, isLoading: movementsLoading } = useStockMovementsQuery(variantId);

  if (itemsLoading) {
    return (
      <div className="flex flex-col gap-16">
        <Skeleton className="h-[52px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  if (!item) {
    return <p className="text-body-sm text-ink-70">Inventory item not found.</p>;
  }

  const variant = productDetail?.variants.find((v) => v.id === variantId);

  // `exactOptionalPropertyTypes` (plan.md §27.1) rejects passing an
  // explicit `undefined` for `description`/`actions` — build the props
  // object so the keys are omitted entirely when there's nothing to show,
  // the same pattern `login/page.tsx`'s `errorMessageProp` uses.
  const descriptionProp = productDetail
    ? {
        description: `${productDetail.product.title}${variant ? ` · ${[variant.options.size, variant.options.color].filter(Boolean).join(' / ')}` : ''}`,
      }
    : {};
  const actionsProp = productDetail
    ? {
        actions: (
          <Link href={`/products/${productDetail.product.id}`} className="text-body-sm text-zamurrad hover:underline">
            View product
          </Link>
        ),
      }
    : {};

  return (
    <div className="flex flex-col gap-16">
      <PageHeader title={item.sku} {...descriptionProp} {...actionsProp} />

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-3">
        <Panel title="Stock summary">
          <dl className="flex flex-col gap-8 text-body-sm">
            <SummaryRow label="On hand" value={item.onHand} />
            <SummaryRow label="Reserved" value={item.reserved} />
            <SummaryRow label="Available" value={item.available} emphasize />
            <SummaryRow label="Low-stock threshold" value={item.lowStockThreshold} />
            <div className="flex items-center justify-between text-ink-70">
              <dt>Backorder</dt>
              <dd>{item.allowBackorder ? 'Allowed' : 'Not allowed'}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Adjust stock" className="lg:col-span-2">
          <InventoryAdjustForm variantId={variantId} currentOnHand={item.onHand} />
        </Panel>
      </div>

      <Panel title="Movement history">
        {movementsLoading ? (
          <Skeleton className="h-[160px]" />
        ) : (
          <DataTable
            columns={MOVEMENT_COLUMNS}
            rows={movements ?? []}
            getRowId={(m) => m.id}
            emptyMessage="No stock movements recorded yet."
          />
        )}
      </Panel>
    </div>
  );
}

function SummaryRow({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className={emphasize ? 'flex items-center justify-between border-t border-line pt-8 font-semibold text-ink' : 'flex items-center justify-between text-ink-70'}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
