'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { AdminOrder, OrderItem, OrderStatus } from '@lulwah/contracts';
import { formatDateTime, formatMoney, formatUaePhone } from '@lulwah/utils';
import { Button } from '@lulwah/ui';
import { DataTable } from '../../../../components/DataTable';
import type { DataTableColumn } from '../../../../components/DataTable';
import { OrderInternalNotes } from '../../../../components/OrderInternalNotes';
import { OrderRefunds } from '../../../../components/OrderRefunds';
import { OrderStatusHistory } from '../../../../components/OrderStatusHistory';
import { Panel } from '../../../../components/Panel';
import { PageHeader } from '../../../../components/PageHeader';
import { Skeleton } from '../../../../components/Skeleton';
import { StatusFlagPill } from '../../../../components/StatusFlagPill';
import { StatusTransitionDropdown } from '../../../../components/StatusTransitionDropdown';
import {
  CARRIERS,
  CARRIER_LABELS,
  useAddOrderNoteMutation,
  useAdminOrderQuery,
  useRefundOrderMutation,
  useUpdateOrderStatusMutation,
} from '../../../../lib/queries/orders';
import type { OrderCarrier } from '../../../../lib/queries/orders';

function mapsUrlFor(order: AdminOrder): string {
  const { geo, area, city, emirate } = order.shippingAddress;
  if (geo) return `https://www.google.com/maps?q=${geo.lat},${geo.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${area}, ${city}, ${emirate}`)}`;
}

const ITEM_COLUMNS: DataTableColumn<OrderItem>[] = [
  { id: 'title', header: 'Item', cell: (i) => i.titleSnapshot },
  { id: 'sku', header: 'SKU', cell: (i) => i.sku },
  { id: 'qty', header: 'Qty', align: 'right', cell: (i) => i.quantity },
  { id: 'unitPrice', header: 'Unit price', align: 'right', cell: (i) => formatMoney(i.unitPriceFils, 'en') },
  { id: 'lineTotal', header: 'Line total', align: 'right', cell: (i) => formatMoney(i.lineTotalFils, 'en') },
  { id: 'fulfilment', header: 'Fulfilment', cell: (i) => i.fulfilmentStatus.replace(/_/g, ' ') },
];

/** plan.md §8.7.4: "Entering `shipped` opens a required mini-form: carrier,
 *  tracking number, optional AWB." Only rendered while the staged next
 *  status is `shipped`. Carrier is a `<select>`, not free text — the real
 *  `PATCH /admin/orders/:id/status` endpoint's `UpdateOrderStatusInput
 *  .carrier` (`@lulwah/contracts`' `order.ts`) is a closed five-value enum
 *  (`lib/queries/orders.ts#CARRIERS`); a free-text value the server doesn't
 *  recognise would 400 rather than silently work. */
function ShipmentFieldset({
  carrier,
  trackingNumber,
  onCarrierChange,
  onTrackingChange,
}: {
  carrier: OrderCarrier | '';
  trackingNumber: string;
  onCarrierChange: (value: OrderCarrier | '') => void;
  onTrackingChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-8">
      <select
        aria-label="Carrier (required)"
        value={carrier}
        onChange={(event) => onCarrierChange(event.target.value as OrderCarrier | '')}
        className="h-[40px] flex-1 border border-line bg-paper px-16 text-body-sm outline-none focus:border-zamurrad"
      >
        <option value="">Carrier (required)…</option>
        {CARRIERS.map((c) => (
          <option key={c} value={c}>
            {CARRIER_LABELS[c]}
          </option>
        ))}
      </select>
      <input
        placeholder="Tracking number (required)"
        value={trackingNumber}
        onChange={(event) => onTrackingChange(event.target.value)}
        className="h-[40px] flex-1 border border-line bg-paper px-16 text-body-sm outline-none focus:border-zamurrad"
      />
    </div>
  );
}

/** plan.md §11.2 rule 6: "All money inputs are in AED with two decimals in
 *  the UI, converted to fils at the boundary." This page's one money input
 *  (the refund amount) converts both ways: `filsToAedInput` seeds the field
 *  with the full refundable balance already in AED-with-cents;
 *  `parseAedInputToFils` turns whatever the staff member typed back into an
 *  integer fils value for the API — `null` for anything that isn't a valid
 *  non-negative number, so the caller can tell "empty/invalid" apart from a
 *  real (even zero) amount. */
function filsToAedInput(fils: number): string {
  return (fils / 100).toFixed(2);
}

function parseAedInputToFils(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const aed = Number(trimmed);
  if (!Number.isFinite(aed) || aed < 0) return null;
  return Math.round(aed * 100);
}

/** plan.md §11.2 rule 3: "Every destructive action needs typed confirmation
 *  for irreversible ones (delete product, refund)" — refund is the plan's
 *  own named example. Typing the order's own order number is the
 *  confirmation gesture (the well-known "type the resource's name to
 *  confirm" pattern) — chosen over a generic word like "REFUND" because it
 *  also makes the staff member re-read which order they're about to refund
 *  money on, not just acknowledge an abstract warning. Amount defaults to
 *  the full refundable balance (`order.service.ts#refundOrder`'s own
 *  `paidFils - refundedFils`) but stays an editable field for a partial
 *  refund. */
function RefundFieldset({
  amountAed,
  reason,
  confirmText,
  orderNumber,
  refundableFils,
  onAmountChange,
  onReasonChange,
  onConfirmChange,
}: {
  amountAed: string;
  reason: string;
  confirmText: string;
  orderNumber: string;
  refundableFils: number;
  onAmountChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        <label htmlFor="refund-amount" className="text-label uppercase tracking-label text-ink-70">
          Refund amount (AED)
        </label>
        <input
          id="refund-amount"
          type="number"
          step={0.01}
          min={0}
          value={amountAed}
          onChange={(event) => onAmountChange(event.target.value)}
          className="h-[40px] w-[160px] border border-line bg-paper px-16 text-body-sm outline-none focus:border-zamurrad"
        />
        <p className="text-body-sm text-ink-70">Refundable balance: {formatMoney(refundableFils, 'en')}</p>
      </div>
      <div className="flex flex-col gap-4">
        <label htmlFor="refund-reason" className="text-label uppercase tracking-label text-ink-70">
          Reason (optional)
        </label>
        <textarea
          id="refund-reason"
          placeholder="e.g. Customer returned item, damaged on arrival…"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          maxLength={500}
          className="min-h-[64px] border border-line bg-paper p-12 text-body-sm outline-none focus:border-zamurrad"
        />
      </div>
      <div className="flex flex-col gap-4">
        <label htmlFor="refund-confirm" className="text-label uppercase tracking-label text-ink-70">
          Type <span className="font-semibold text-ink">{orderNumber}</span> to confirm this refund
        </label>
        <input
          id="refund-confirm"
          placeholder={orderNumber}
          value={confirmText}
          onChange={(event) => onConfirmChange(event.target.value)}
          className="h-[40px] border border-line bg-paper px-16 text-body-sm outline-none focus:border-zamurrad"
        />
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = Array.isArray(params.id) ? (params.id[0] ?? '') : (params.id ?? '');

  const { data: order, isLoading } = useAdminOrderQuery(orderId);
  const updateStatus = useUpdateOrderStatusMutation();
  const addNote = useAddOrderNoteMutation(orderId);
  const refundOrder = useRefundOrderMutation();

  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [carrier, setCarrier] = useState<OrderCarrier | ''>('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [noteDraft, setNoteDraft] = useState('');

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmountAed, setRefundAmountAed] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundConfirmText, setRefundConfirmText] = useState('');

  const resetPendingChange = () => {
    setPendingStatus(null);
    setNote('');
    setNotifyCustomer(true);
    setCarrier('');
    setTrackingNumber('');
    setValidationError(null);
  };

  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    if (pendingStatus === 'shipped' && (carrier === '' || !trackingNumber.trim())) {
      setValidationError('Carrier and tracking number are required to mark an order as shipped.');
      return;
    }
    updateStatus.mutate(
      {
        orderId,
        nextStatus: pendingStatus,
        note: note.trim() || undefined,
        notifyCustomer,
        trackingNumber: pendingStatus === 'shipped' ? trackingNumber.trim() : undefined,
        carrier: pendingStatus === 'shipped' && carrier !== '' ? carrier : undefined,
      },
      { onSuccess: resetPendingChange },
    );
  };

  const submitNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    addNote.mutate(text, { onSuccess: () => setNoteDraft('') });
  };

  const openRefundForm = () => {
    if (!order) return;
    setRefundAmountAed(filsToAedInput(order.paidFils - order.refundedFils));
    setRefundReason('');
    setRefundConfirmText('');
    setRefundOpen(true);
  };

  const resetRefundForm = () => {
    setRefundOpen(false);
    setRefundAmountAed('');
    setRefundReason('');
    setRefundConfirmText('');
  };

  const confirmRefund = () => {
    if (!order) return;
    const refundableFils = order.paidFils - order.refundedFils;
    const amountFils = parseAedInputToFils(refundAmountAed);
    if (amountFils === null || amountFils <= 0 || amountFils > refundableFils) return;
    if (refundConfirmText.trim() !== order.orderNumber) return;
    refundOrder.mutate(
      { orderId, amountFils, reason: refundReason.trim() || undefined },
      { onSuccess: resetRefundForm },
    );
  };

  const handleCopyAddress = async () => {
    if (!order) return;
    const { firstName, lastName, area, buildingName, landmark, city } = order.shippingAddress;
    const text = `${firstName} ${lastName}\n${buildingName}, ${area}\n${landmark}\n${city}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-16">
        <Skeleton className="h-[52px]" />
        <Skeleton className="h-[240px]" />
      </div>
    );
  }

  if (!order) {
    return <p className="text-body-sm text-ink-70">Order not found.</p>;
  }

  // Mirrors `order.service.ts#refundOrder`'s own eligibility check
  // (`paymentStatus` must be `paid`/`partially_refunded`, and there must be
  // something still refundable) — a UI-side preview of the same rule the
  // server actually enforces, not a replacement for it.
  const refundableFils = order.paidFils - order.refundedFils;
  const canRefund = (order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded') && refundableFils > 0;
  const parsedRefundAmountFils = parseAedInputToFils(refundAmountAed);
  const refundAmountError =
    parsedRefundAmountFils === null
      ? 'Enter a refund amount.'
      : parsedRefundAmountFils <= 0
        ? 'Amount must be greater than zero.'
        : parsedRefundAmountFils > refundableFils
          ? `Amount cannot exceed the refundable balance of ${formatMoney(refundableFils, 'en')}.`
          : null;
  const refundConfirmError = refundConfirmText.trim() !== order.orderNumber ? `Type ${order.orderNumber} to confirm.` : null;
  const canSubmitRefund = refundAmountError === null && refundConfirmError === null && !refundOrder.isPending;

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title={order.orderNumber}
        description={`Placed ${formatDateTime(order.placedAt, 'en')} · ${order.paymentStatus} · ${formatMoney(order.grandTotalFils, 'en')}`}
        actions={<StatusFlagPill status={order.status} />}
      />

      <Panel title="Update status">
        <div className="flex flex-col gap-16">
          <StatusTransitionDropdown
            currentStatus={order.status}
            disabled={updateStatus.isPending}
            onApply={(nextStatus) => {
              setPendingStatus(nextStatus);
              setValidationError(null);
            }}
          />

          {pendingStatus ? (
            <div className="flex flex-col gap-8 border border-line bg-nacre p-16">
              <p className="text-body-sm text-ink">
                Changing status to <strong>{pendingStatus}</strong>.
              </p>
              {pendingStatus === 'shipped' ? (
                <ShipmentFieldset
                  carrier={carrier}
                  trackingNumber={trackingNumber}
                  onCarrierChange={setCarrier}
                  onTrackingChange={setTrackingNumber}
                />
              ) : null}
              <textarea
                placeholder="Internal note (optional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                className="min-h-[64px] border border-line bg-paper p-12 text-body-sm outline-none focus:border-zamurrad"
              />
              <label className="flex items-center gap-8 text-body-sm text-ink">
                <input type="checkbox" checked={notifyCustomer} onChange={(event) => setNotifyCustomer(event.target.checked)} />
                Notify customer
              </label>
              {validationError ? <p className="text-body-sm text-danger">{validationError}</p> : null}
              {updateStatus.isError ? (
                <p className="text-body-sm text-danger">{updateStatus.error.message}</p>
              ) : null}
              <div className="flex gap-8">
                <Button type="button" onClick={confirmStatusChange} disabled={updateStatus.isPending}>
                  {updateStatus.isPending ? 'Applying…' : 'Confirm status change'}
                </Button>
                <Button type="button" variant="tertiary" onClick={resetPendingChange} disabled={updateStatus.isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-3">
        <Panel title="Items" className="lg:col-span-2">
          <DataTable columns={ITEM_COLUMNS} rows={order.items} getRowId={(i) => i.id} emptyMessage="No items." />
        </Panel>

        <Panel title="Money breakdown">
          <dl className="flex flex-col gap-8 text-body-sm">
            <MoneyRow label="Subtotal" fils={order.subtotalFils} />
            <MoneyRow label="Discounts" fils={-order.discountTotalFils} />
            <MoneyRow label="Shipping" fils={order.shippingFils} />
            <MoneyRow label="COD fee" fils={order.codFeeFils} />
            <MoneyRow label="VAT" fils={order.taxFils} />
            <MoneyRow label="Total" fils={order.grandTotalFils} emphasize />
            <MoneyRow label="Paid" fils={order.paidFils} />
            <MoneyRow label="Balance due" fils={order.balanceDueFils} />
          </dl>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <Panel title="Shipping address" actions={<button onClick={() => void handleCopyAddress()} className="text-body-sm text-zamurrad hover:underline">{copied ? 'Copied' : 'Copy'}</button>}>
          <p className="text-body-sm text-ink">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            <br />
            {formatUaePhone(order.shippingAddress.phone.number)}
            <br />
            {order.shippingAddress.buildingName}, {order.shippingAddress.area}
            <br />
            {order.shippingAddress.landmark}
            <br />
            {order.shippingAddress.city}
          </p>
          <a href={mapsUrlFor(order)} target="_blank" rel="noreferrer" className="mt-8 inline-block text-body-sm text-zamurrad hover:underline">
            Open in Google Maps
          </a>
        </Panel>

        <Panel title="Status history">
          <OrderStatusHistory history={order.statusHistory} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <Panel title="Refund">
          {!refundOpen ? (
            <div className="flex flex-col gap-8">
              <p className="text-body-sm text-ink-70">
                Refundable: {formatMoney(Math.max(refundableFils, 0), 'en')} of {formatMoney(order.paidFils, 'en')} paid.
              </p>
              {!canRefund ? (
                <p className="text-body-sm text-ink-70">
                  {refundableFils <= 0 ? 'Nothing left to refund.' : 'This order has no captured payment to refund.'}
                </p>
              ) : null}
              <div>
                <Button type="button" variant="secondary" onClick={openRefundForm} disabled={!canRefund}>
                  Refund…
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              <RefundFieldset
                amountAed={refundAmountAed}
                reason={refundReason}
                confirmText={refundConfirmText}
                orderNumber={order.orderNumber}
                refundableFils={refundableFils}
                onAmountChange={setRefundAmountAed}
                onReasonChange={setRefundReason}
                onConfirmChange={setRefundConfirmText}
              />
              <p className="text-body-sm text-danger">
                This cannot be undone once the gateway accepts it. The customer&apos;s original payment method is
                credited.
              </p>
              {refundOrder.isError ? <p className="text-body-sm text-danger">{refundOrder.error.message}</p> : null}
              <div className="flex gap-8">
                <Button type="button" onClick={confirmRefund} disabled={!canSubmitRefund}>
                  {refundOrder.isPending ? 'Refunding…' : 'Confirm refund'}
                </Button>
                <Button type="button" variant="tertiary" onClick={resetRefundForm} disabled={refundOrder.isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Refund history">
          <OrderRefunds refunds={order.refunds} />
        </Panel>
      </div>

      <Panel title="Internal notes">
        <div className="flex flex-col gap-16">
          <p className="text-body-sm text-ink-70">
            Staff-only — never shown to the customer (plan.md §9.7). Round-trips for real: a note posted here is
            durably persisted and visible to any staff member viewing this order, including after a refresh.
          </p>
          <OrderInternalNotes notes={order.internalNotes} />
          <div className="flex flex-col gap-8">
            <textarea
              placeholder="Add an internal note…"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              maxLength={2000}
              className="min-h-[64px] border border-line bg-paper p-12 text-body-sm outline-none focus:border-zamurrad"
            />
            {addNote.isError ? <p className="text-body-sm text-danger">{addNote.error.message}</p> : null}
            <div>
              <Button type="button" variant="secondary" onClick={submitNote} disabled={addNote.isPending || !noteDraft.trim()}>
                {addNote.isPending ? 'Saving…' : 'Add note'}
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function MoneyRow({ label, fils, emphasize }: { label: string; fils: number; emphasize?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${emphasize ? 'border-t border-line pt-8 font-semibold text-ink' : 'text-ink-70'}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoney(fils, 'en')}</dd>
    </div>
  );
}
