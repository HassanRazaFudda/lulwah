'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { Order, OrderItem, OrderStatus } from '@lulwah/contracts';
import { formatDateTime, formatMoney, formatUaePhone } from '@lulwah/utils';
import { Button } from '@lulwah/ui';
import { DataTable } from '../../../../components/DataTable';
import type { DataTableColumn } from '../../../../components/DataTable';
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
  useUpdateOrderStatusMutation,
} from '../../../../lib/queries/orders';
import type { OrderCarrier } from '../../../../lib/queries/orders';

function mapsUrlFor(order: Order): string {
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

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = Array.isArray(params.id) ? (params.id[0] ?? '') : (params.id ?? '');

  const { data: order, isLoading } = useAdminOrderQuery(orderId);
  const updateStatus = useUpdateOrderStatusMutation();
  const addNote = useAddOrderNoteMutation(orderId);

  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [carrier, setCarrier] = useState<OrderCarrier | ''>('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // `POST /admin/orders/:id/notes` persists for real (confirmed live — see
  // task report), but no endpoint returns `internalNotes` back to a client
  // (`order.mapper.ts#toOrderDto` deliberately omits it — an internal-only
  // Mongoose field, see `lib/queries/orders.ts`'s doc comment on
  // `useAddOrderNoteMutation`). This session-local list is what stands in
  // for a read-back until that DTO gap is closed on the API side.
  const [sessionNotes, setSessionNotes] = useState<{ text: string; at: Date }[]>([]);
  const [noteDraft, setNoteDraft] = useState('');

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
    addNote.mutate(text, {
      onSuccess: () => {
        setSessionNotes((prev) => [...prev, { text, at: new Date() }]);
        setNoteDraft('');
      },
    });
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

      <Panel title="Internal notes">
        <div className="flex flex-col gap-16">
          <p className="text-body-sm text-ink-70">
            Staff-only — never shown to the customer (plan.md §9.7). Saved to the order in the database, but this
            API doesn&apos;t return stored notes on read yet, so this list only shows notes added in this browser
            session.
          </p>
          {sessionNotes.length === 0 ? (
            <p className="text-body-sm text-ink-70">No notes added this session.</p>
          ) : (
            <ul className="flex flex-col gap-8">
              {sessionNotes.map((entry, index) => (
                <li key={index} className="border-l-2 border-line pl-12">
                  <p className="text-body-sm text-ink">{entry.text}</p>
                  <p className="mt-4 text-body-sm text-ink-70">{formatDateTime(entry.at, 'en')}</p>
                </li>
              ))}
            </ul>
          )}
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
