'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { Order, Review, WishlistItem } from '@lulwah/contracts';
import { formatDate, formatDateTime, formatMoney, formatUaePhone } from '@lulwah/utils';
import { Button } from '@lulwah/ui';
import { DataTable } from '../../../../components/DataTable';
import type { DataTableColumn } from '../../../../components/DataTable';
import { Panel } from '../../../../components/Panel';
import { PageHeader } from '../../../../components/PageHeader';
import { Skeleton } from '../../../../components/Skeleton';
import { StatusFlagPill } from '../../../../components/StatusFlagPill';
import { ReviewStatusPill } from '../../../../components/ReviewStatusPill';
import type { AdminCustomerCartItem } from '../../../../lib/queries/customers';
import { useAdminCustomerQuery, useUpdateCustomerMutation } from '../../../../lib/queries/customers';
import { useAdminCustomerReviewsQuery } from '../../../../lib/queries/reviews';
import { useAdminCustomerWishlistQuery } from '../../../../lib/queries/wishlist';
import { useAdminProductsQuery } from '../../../../lib/queries/products';

const ORDERS_PAGE_SIZE = 10;

const ORDER_COLUMNS: DataTableColumn<Order>[] = [
  { id: 'orderNumber', header: 'Order #', cell: (o) => <span className="font-semibold text-ink">{o.orderNumber}</span> },
  { id: 'date', header: 'Date', cell: (o) => formatDate(o.placedAt, 'en') },
  { id: 'status', header: 'Status', cell: (o) => <StatusFlagPill status={o.status} size="sm" /> },
  { id: 'total', header: 'Total', align: 'right', cell: (o) => formatMoney(o.grandTotalFils, 'en') },
];

const CART_ITEM_COLUMNS: DataTableColumn<AdminCustomerCartItem>[] = [
  { id: 'variant', header: 'Variant', cell: (i) => <span className="font-mono text-body-sm">{i.variantId.slice(-8)}</span> },
  { id: 'qty', header: 'Qty', align: 'right', cell: (i) => i.quantity },
  { id: 'unitPrice', header: 'Unit price', align: 'right', cell: (i) => formatMoney(i.unitPriceFils, 'en') },
  { id: 'lineTotal', header: 'Line total', align: 'right', cell: (i) => formatMoney(i.unitPriceFils * i.quantity, 'en') },
  {
    id: 'stock',
    header: 'Available stock',
    align: 'right',
    cell: (i) => (i.availableStock < i.quantity ? <span className="text-danger">{i.availableStock}</span> : i.availableStock),
  },
  { id: 'priceChanged', header: 'Price changed', cell: (i) => (i.priceChanged ? 'Yes' : 'No') },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-8 last:border-0">
      <dt className="text-body-sm text-ink-70">{label}</dt>
      <dd className="text-body-sm text-ink">{value}</dd>
    </div>
  );
}

/**
 * plan.md §11.1's Customers detail panel: "profile, addresses, order
 * history, current cart contents, wishlist, reviews, measurement profiles,
 * internal notes, tag editor, COD risk flags." Against the real
 * `GET /admin/customers/:id` (`customer` module — see
 * `docs/implemented-plan.md` and `lib/queries/customers.ts`'s doc comment
 * for exactly what that composes and how it was verified).
 *
 * Wishlist and Reviews panels were added in P4, once the `engagement`
 * module shipped real `GET /admin/customers/:id/{wishlist,reviews}`
 * endpoints for exactly this screen (`engagement.routes.ts`'s own doc
 * comment names this page as the reason those two routes exist) — they are
 * separate fetches from `GET /admin/customers/:id` itself, not folded into
 * `AdminCustomerDetailResponse`, since that response shape belongs to the
 * `customer` module and `engagement` composes across the module boundary
 * the same way `catalog`/`order`/`cart` already do for the rest of this
 * page (plan.md §5.3: "a module may only touch another module through its
 * exported service interface"). Measurement profiles still have no
 * section — nothing in this codebase builds that anywhere (checked the
 * backend directly; `customer.dto.ts`'s own doc comment says the same).
 */
export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = Array.isArray(params.id) ? (params.id[0] ?? '') : (params.id ?? '');

  const [ordersPage, setOrdersPage] = useState(1);
  const { data, isLoading } = useAdminCustomerQuery(customerId, ordersPage, ORDERS_PAGE_SIZE);
  const updateCustomer = useUpdateCustomerMutation();
  const { data: reviews, isLoading: reviewsLoading } = useAdminCustomerReviewsQuery(customerId);
  const { data: wishlist, isLoading: wishlistLoading } = useAdminCustomerWishlistQuery(customerId);
  const productsQuery = useAdminProductsQuery();

  const productById = useMemo(() => new Map((productsQuery.data ?? []).map((p) => [p.id, p])), [productsQuery.data]);
  const productLabel = (productId: string): string => productById.get(productId)?.title ?? productId.slice(-8);

  const [tagDraft, setTagDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');

  // Initializes the notes draft the first time data lands for this
  // customer id, and again if the id changes — but deliberately NOT on
  // every later background refetch (e.g. the invalidate a tag-only
  // mutation triggers via `onSettled`), so an in-progress notes edit here
  // is never silently clobbered by an unrelated write.
  const notesInitializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (data && notesInitializedFor.current !== customerId) {
      setNotesDraft(data.customer.notesInternal);
      notesInitializedFor.current = customerId;
    }
  }, [data, customerId]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-16">
        <Skeleton className="h-[52px]" />
        <Skeleton className="h-[240px]" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-body-sm text-ink-70">Customer not found.</p>;
  }

  const { customer, addresses, orders, ordersTotal, currentCart, codRisk } = data;

  const addTag = () => {
    const value = tagDraft.trim();
    if (!value || customer.tags.includes(value)) {
      setTagDraft('');
      return;
    }
    updateCustomer.mutate({ id: customerId, tags: [...customer.tags, value] });
    setTagDraft('');
  };

  const removeTag = (tagToRemove: string) => {
    updateCustomer.mutate({ id: customerId, tags: customer.tags.filter((t) => t !== tagToRemove) });
  };

  const notesDirty = notesDraft !== customer.notesInternal;
  const saveNotes = () => {
    updateCustomer.mutate({ id: customerId, notesInternal: notesDraft });
  };

  const ordersPageCount = Math.max(1, Math.ceil(ordersTotal / ORDERS_PAGE_SIZE));

  const wishlistColumns: DataTableColumn<WishlistItem>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: (item) => (
        <Link href={`/products/${item.productId}`} className="text-zamurrad underline underline-offset-4">
          {productLabel(item.productId)}
        </Link>
      ),
    },
    {
      id: 'variant',
      header: 'Variant',
      cell: (item) => (item.variantId ? <span className="font-mono text-body-sm">{item.variantId.slice(-8)}</span> : '—'),
    },
    { id: 'priceAtAdd', header: 'Price at add', align: 'right', cell: (item) => formatMoney(item.priceAtAddFils, 'en') },
    { id: 'addedAt', header: 'Added', cell: (item) => formatDate(item.addedAt, 'en') },
  ];

  const reviewColumns: DataTableColumn<Review>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: (r) => (
        <Link href={`/products/${r.productId}`} className="text-zamurrad underline underline-offset-4">
          {productLabel(r.productId)}
        </Link>
      ),
    },
    { id: 'rating', header: 'Rating', align: 'center', cell: (r) => `${r.rating} / 5` },
    {
      id: 'title',
      header: 'Review',
      cell: (r) => (
        <span className="block max-w-[220px] truncate" title={r.title}>
          {r.title}
        </span>
      ),
    },
    { id: 'verified', header: 'Verified', align: 'center', cell: (r) => (r.isVerifiedPurchase ? 'Yes' : 'No') },
    { id: 'status', header: 'Status', cell: (r) => <ReviewStatusPill status={r.status} size="sm" /> },
    { id: 'date', header: 'Date', cell: (r) => formatDate(r.createdAt, 'en') },
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`.trim() || customer.email || 'Customer'}
        description={`${customer.stats.orderCount} order${customer.stats.orderCount === 1 ? '' : 's'} · ${formatMoney(customer.stats.totalSpentFils, 'en')} lifetime spend · member since ${formatDate(customer.createdAt, 'en')}`}
      />

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <Panel title="Profile">
          <dl className="flex flex-col">
            <Row label="Email" value={customer.email ?? '—'} />
            <Row label="Email verified" value={customer.emailVerifiedAt ? formatDateTime(customer.emailVerifiedAt, 'en') : 'No'} />
            <Row label="Phone" value={customer.phone ? formatUaePhone(customer.phone.number) : '—'} />
            <Row label="Phone verified" value={customer.phoneVerifiedAt ? formatDateTime(customer.phoneVerifiedAt, 'en') : 'No'} />
            <Row label="Sign-in method" value={customer.provider} />
            <Row label="Status" value={customer.status} />
            <Row label="Locale" value={customer.locale === 'ar' ? 'Arabic' : 'English'} />
            <Row label="Avg order value" value={formatMoney(customer.stats.avgOrderValueFils, 'en')} />
            <Row label="Last order" value={customer.stats.lastOrderAt ? formatDateTime(customer.stats.lastOrderAt, 'en') : '—'} />
          </dl>
        </Panel>

        <Panel title="Marketing consent">
          <dl className="flex flex-col">
            <Row label="Email" value={customer.marketing.email ? 'Opted in' : 'Opted out'} />
            <Row label="SMS" value={customer.marketing.sms ? 'Opted in' : 'Opted out'} />
            <Row label="WhatsApp" value={customer.marketing.whatsapp ? 'Opted in' : 'Opted out'} />
            <Row
              label="Consent given"
              value={customer.marketing.consentAt ? formatDateTime(customer.marketing.consentAt, 'en') : 'Never'}
            />
          </dl>
        </Panel>
      </div>

      <Panel title="COD risk signal">
        <p className="mb-12 text-body-sm text-ink-70">
          Not a fraud-scoring model: no risk-scoring pipeline exists anywhere in this codebase (checked
          `payment/cod.gateway.ts` and the rest of the `payment` module). This is a transparent, real-data signal
          only: whether staff have applied the <code>risky_cod</code> tag below, plus this customer&apos;s actual
          COD order history.
        </p>
        <dl className="flex flex-col">
          <Row label="Tagged risky_cod" value={codRisk.taggedRisky ? 'Yes' : 'No'} />
          <Row label="COD orders placed" value={codRisk.codOrdersPlaced} />
          <Row label="COD orders cancelled" value={codRisk.codOrdersCancelled} />
          <Row label="Cancellation rate" value={`${Math.round(codRisk.cancelledRate * 100)}%`} />
        </dl>
      </Panel>

      <Panel title="Addresses">
        {addresses.length === 0 ? (
          <p className="text-body-sm text-ink-70">No saved addresses.</p>
        ) : (
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            {addresses.map((address) => (
              <div key={address.id} className="border border-line p-16">
                <div className="mb-8 flex items-center gap-8">
                  <span className="rounded-sm bg-pearl px-8 py-4 text-[10px] uppercase tracking-label text-ink-70">
                    {address.label}
                  </span>
                  {address.isDefaultShipping ? (
                    <span className="text-[10px] uppercase tracking-label text-zamurrad">Default shipping</span>
                  ) : null}
                  {address.isDefaultBilling ? (
                    <span className="text-[10px] uppercase tracking-label text-zamurrad">Default billing</span>
                  ) : null}
                </div>
                <p className="text-body-sm text-ink">
                  {address.firstName} {address.lastName}
                  <br />
                  {formatUaePhone(address.phone.number)}
                  <br />
                  {address.buildingName}, {address.area}
                  <br />
                  {address.landmark}
                  <br />
                  {address.city}, {address.emirate.replace(/_/g, ' ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Order history" actions={<span className="text-body-sm text-ink-70">{ordersTotal} total</span>}>
        <DataTable
          columns={ORDER_COLUMNS}
          rows={orders}
          getRowId={(o) => o.id}
          onRowClick={(o) => router.push(`/orders/${o.id}`)}
          emptyMessage="No orders yet."
        />
        {ordersPageCount > 1 ? (
          <div className="mt-12 flex items-center justify-between">
            <Button
              type="button"
              variant="tertiary"
              disabled={ordersPage <= 1}
              onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-body-sm text-ink-70">
              Page {ordersPage} of {ordersPageCount}
            </span>
            <Button
              type="button"
              variant="tertiary"
              disabled={ordersPage >= ordersPageCount}
              onClick={() => setOrdersPage((p) => Math.min(ordersPageCount, p + 1))}
            >
              Next
            </Button>
          </div>
        ) : null}
      </Panel>

      <Panel title="Current cart">
        {!currentCart ? (
          <p className="text-body-sm text-ink-70">No active cart.</p>
        ) : currentCart.items.length === 0 ? (
          <p className="text-body-sm text-ink-70">Cart is empty.</p>
        ) : (
          <div className="flex flex-col gap-12">
            <p className="text-body-sm text-ink-70">
              `CartItem` snapshots carry no product title/brand/image (same documented gap as the storefront&apos;s
              own cart client, `docs/implemented-plan.md` §5.4), so this shows variant id, quantity and price only.
            </p>
            <DataTable
              columns={CART_ITEM_COLUMNS}
              rows={currentCart.items}
              getRowId={(i) => i.id}
              emptyMessage="Cart has no items."
            />
            <dl className="flex flex-col">
              <Row label="Subtotal" value={formatMoney(currentCart.totals.subtotalFils, 'en')} />
              <Row label="Discounts" value={formatMoney(-currentCart.totals.discountFils, 'en')} />
              <Row label="Grand total" value={formatMoney(currentCart.totals.grandTotalFils, 'en')} />
            </dl>
          </div>
        )}
      </Panel>

      <Panel title="Wishlist">
        {wishlistLoading ? (
          <Skeleton className="h-[80px]" />
        ) : !wishlist || wishlist.items.length === 0 ? (
          <p className="text-body-sm text-ink-70">{wishlist ? 'Wishlist is empty.' : 'No wishlist yet.'}</p>
        ) : (
          <DataTable
            columns={wishlistColumns}
            rows={wishlist.items}
            getRowId={(item) => `${item.productId}:${item.variantId ?? 'any'}`}
            emptyMessage="Wishlist is empty."
          />
        )}
      </Panel>

      <Panel title="Reviews" actions={<span className="text-body-sm text-ink-70">{(reviews ?? []).length} total</span>}>
        {reviewsLoading ? (
          <Skeleton className="h-[80px]" />
        ) : (
          <DataTable columns={reviewColumns} rows={reviews ?? []} getRowId={(r) => r.id} emptyMessage="No reviews yet." />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <Panel title="Tags">
          <div className="flex flex-col gap-12">
            <div className="flex flex-wrap gap-8">
              {customer.tags.length === 0 ? (
                <p className="text-body-sm text-ink-70">No tags.</p>
              ) : (
                customer.tags.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-8 rounded-sm bg-pearl px-8 py-4 text-[10px] uppercase tracking-label text-ink-70"
                  >
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t}`}
                      onClick={() => removeTag(t)}
                      disabled={updateCustomer.isPending}
                      className="text-ink-70 hover:text-danger"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex gap-8">
              <input
                type="text"
                placeholder="Add a tag (e.g. vip, wholesale, risky_cod)…"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addTag();
                  }
                }}
                className="h-[40px] flex-1 border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
              />
              <Button type="button" variant="secondary" onClick={addTag} disabled={updateCustomer.isPending || !tagDraft.trim()}>
                Add tag
              </Button>
            </div>
            {updateCustomer.isError ? <p className="text-body-sm text-danger">{updateCustomer.error.message}</p> : null}
          </div>
        </Panel>

        <Panel title="Internal notes">
          <div className="flex flex-col gap-12">
            <p className="text-body-sm text-ink-70">Staff-only: never shown to the customer (plan.md §7.1).</p>
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              maxLength={5000}
              placeholder="Internal notes about this customer…"
              className="min-h-[120px] border border-line bg-paper p-12 text-body-sm outline-none focus:border-zamurrad"
            />
            {updateCustomer.isError ? <p className="text-body-sm text-danger">{updateCustomer.error.message}</p> : null}
            <div>
              <Button type="button" onClick={saveNotes} disabled={!notesDirty || updateCustomer.isPending}>
                {updateCustomer.isPending ? 'Saving…' : 'Save notes'}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
