'use client';

import { useMemo, useState } from 'react';
import type { Review, ReviewStatus } from '@lulwah/contracts';
import { formatDate } from '@lulwah/utils';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { AccessDenied } from '../../../components/AccessDenied';
import { ReviewStatusPill } from '../../../components/ReviewStatusPill';
import { ReviewDrawer } from '../../../components/reviews/ReviewDrawer';
import { isForbiddenError } from '../../../lib/api-client';
import { getSessionUser } from '../../../lib/auth-session';
import { canWriteReviews } from '../../../lib/permissions';
import { pushToast } from '../../../lib/stores/toast-store';
import { useAdminReviewsQuery, useUpdateReviewStatusMutation, useReplyToReviewMutation } from '../../../lib/queries/reviews';
import { useAdminProductsQuery } from '../../../lib/queries/products';
import { useAdminCustomersQuery } from '../../../lib/queries/customers';

/**
 * plan.md P4's reviews moderation surface — backed by the real
 * `GET/PATCH /admin/reviews*` (`apps/api/src/modules/engagement/`). No
 * placeholder route existed for this before this task (checked
 * `app/(dashboard)/` and `Sidebar.tsx` — neither had a "Reviews" entry;
 * the nav item was added alongside this page).
 *
 * Gated on `reviews.read` for the list itself (`AccessDenied`, the same
 * `isForbiddenError` pattern `AuditLogPage`/Reports already establish) and
 * on `reviews.write` for the approve/reject/reply actions — see
 * `lib/permissions.ts#canWriteReviews`'s doc comment on why that gate is a
 * client-side courtesy only, not the real enforcement (`requireReviewsWrite()`
 * server-side).
 *
 * `productId`/`userId` are bare ObjectIds on the wire (`Review` has no
 * populated product/customer relation — verified against `review.mapper.ts`),
 * so this screen resolves labels the same way `HomeSectionSettingsForm.tsx`
 * resolves `collectionId`/`brandIds`: a plain `useAdminProductsQuery()`/
 * `useAdminCustomersQuery()` reference-list fetch turned into an id→record
 * map, falling back to a truncated id (same fallback
 * `CustomerDetailPage`'s own `CART_ITEM_COLUMNS` uses for an unresolved
 * `variantId`) if the reference list hasn't loaded or the id is missing
 * from it.
 */

const STATUS_OPTIONS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All statuses' },
];

export default function ReviewsPage() {
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useAdminReviewsQuery({ status: statusFilter === 'all' ? undefined : statusFilter }, page);
  const productsQuery = useAdminProductsQuery();
  const customersQuery = useAdminCustomersQuery();
  const updateStatus = useUpdateReviewStatusMutation();
  const reply = useReplyToReviewMutation();

  const canWrite = canWriteReviews(getSessionUser()?.role);

  const productById = useMemo(() => new Map((productsQuery.data ?? []).map((p) => [p.id, p])), [productsQuery.data]);
  const customerById = useMemo(() => new Map((customersQuery.data ?? []).map((c) => [c.id, c])), [customersQuery.data]);

  function productLabel(productId: string): string {
    return productById.get(productId)?.title ?? productId.slice(-8);
  }
  function customerLabel(userId: string): string {
    const customer = customerById.get(userId);
    if (!customer) return userId.slice(-8);
    const name = `${customer.firstName} ${customer.lastName}`.trim();
    return name || customer.email || userId.slice(-8);
  }

  function updateFilter(next: ReviewStatus | 'all'): void {
    setStatusFilter(next);
    setPage(1);
  }

  if (query.isError && isForbiddenError(query.error)) {
    return (
      <div className="flex flex-col gap-16">
        <PageHeader title="Reviews" description="Moderate product reviews: approve, reject, and reply." />
        <AccessDenied
          permission="reviews.read"
          description="Review moderation is restricted to merchandising and content roles."
        />
      </div>
    );
  }

  const reviews = query.data?.reviews ?? [];
  const total = query.data?.total ?? 0;
  const limit = query.data?.limit ?? 50;
  const hasMore = query.data?.hasMore ?? false;
  const selectedReview = reviews.find((r) => r.id === selectedId) ?? null;

  const columns: DataTableColumn<Review>[] = [
    { id: 'product', header: 'Product', cell: (r) => productLabel(r.productId) },
    { id: 'rating', header: 'Rating', align: 'center', cell: (r) => `${r.rating} / 5` },
    {
      id: 'title',
      header: 'Review',
      cell: (r) => (
        <span className="block max-w-[280px] truncate" title={r.title}>
          {r.title}
        </span>
      ),
    },
    { id: 'customer', header: 'Customer', cell: (r) => customerLabel(r.userId) },
    {
      id: 'verified',
      header: 'Verified',
      align: 'center',
      cell: (r) =>
        r.isVerifiedPurchase ? (
          <span className="text-[10px] font-semibold uppercase tracking-label text-zamurrad">Verified</span>
        ) : (
          '—'
        ),
    },
    { id: 'status', header: 'Status', cell: (r) => <ReviewStatusPill status={r.status} size="sm" /> },
    { id: 'date', header: 'Date', cell: (r) => formatDate(r.createdAt, 'en') },
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title="Reviews"
        description={
          query.data
            ? `${total} review${total === 1 ? '' : 's'}`
            : 'Moderate product reviews: approve, reject, and reply.'
        }
      />

      <div className="flex flex-wrap items-center gap-8">
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => updateFilter(event.target.value as ReviewStatus | 'all')}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[36px]" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-8 border border-line bg-paper p-16">
          <p className="text-body-sm text-danger">
            {query.error instanceof Error ? query.error.message : 'Failed to load reviews.'}
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="text-body-sm font-semibold text-zamurrad underline underline-offset-4"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={reviews}
            getRowId={(r) => r.id}
            onRowClick={(r) => setSelectedId(r.id)}
            emptyMessage="No reviews match this filter."
          />
          <div className="flex items-center justify-between gap-16">
            <p className="text-body-sm text-ink-70">
              Page {page} of {Math.max(1, Math.ceil(total / limit))} ({total} total)
            </p>
            <div className="flex gap-8">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-[36px] border border-line bg-paper px-16 text-body-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="h-[36px] border border-line bg-paper px-16 text-body-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {selectedReview ? (
        <ReviewDrawer
          review={selectedReview}
          productLabel={productLabel(selectedReview.productId)}
          productHref={`/products/${selectedReview.productId}`}
          customerLabel={customerLabel(selectedReview.userId)}
          customerHref={`/customers/${selectedReview.userId}`}
          canWrite={canWrite}
          isUpdatingStatus={updateStatus.isPending}
          isReplying={reply.isPending}
          onApprove={() =>
            updateStatus.mutate(
              { id: selectedReview.id, status: 'approved' },
              {
                onSuccess: () => pushToast('success', 'Review approved.'),
                onError: (error) => pushToast('error', `Could not approve review: ${error.message}`),
              },
            )
          }
          onReject={() =>
            updateStatus.mutate(
              { id: selectedReview.id, status: 'rejected' },
              {
                onSuccess: () => pushToast('success', 'Review rejected.'),
                onError: (error) => pushToast('error', `Could not reject review: ${error.message}`),
              },
            )
          }
          onReply={(text) =>
            reply.mutate(
              { id: selectedReview.id, adminReply: text },
              {
                onSuccess: () => pushToast('success', 'Reply saved.'),
                onError: (error) => pushToast('error', `Could not save reply: ${error.message}`),
              },
            )
          }
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
