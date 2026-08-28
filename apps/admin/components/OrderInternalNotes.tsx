import type { OrderInternalNote } from '@lulwah/contracts';
import { formatDateTime } from '@lulwah/utils';
import { getSessionUser } from '../lib/auth-session';

export interface OrderInternalNotesProps {
  notes: OrderInternalNote[];
}

/**
 * Read side of `POST /admin/orders/:id/notes` (plan.md §9.7, §11.1
 * "internal notes") — staff-only, never shown to the customer. As of the
 * P3 `AdminOrder` fix (`lib/queries/orders.ts`'s doc comment), this list is
 * the order's real, durably-persisted `internalNotes`, not a per-browser
 * session echo: a note posted by any staff member is visible here to every
 * other staff member, and survives a page refresh. Rendered oldest-first,
 * matching `OrderStatusHistory`'s own convention for the same reason (an
 * append-only audit trail reads naturally in the order it happened).
 */
export function OrderInternalNotes({ notes }: OrderInternalNotesProps) {
  if (notes.length === 0) {
    return <p className="text-body-sm text-ink-70">No internal notes yet.</p>;
  }

  const currentUserId = getSessionUser()?.id;

  return (
    <ul className="flex flex-col gap-12">
      {notes.map((entry, index) => (
        <li key={`${entry.at.toISOString()}-${index}`} className="border-l-2 border-line pl-12">
          <p className="text-body-sm text-ink">{entry.note}</p>
          <p className="mt-4 text-body-sm text-ink-70">
            {formatDateTime(entry.at, 'en')} · {entry.byUserId === currentUserId ? 'You' : `Staff (${entry.byUserId})`}
          </p>
        </li>
      ))}
    </ul>
  );
}
