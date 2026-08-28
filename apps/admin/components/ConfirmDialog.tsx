'use client';

import { useState } from 'react';
import { Button } from '@lulwah/ui';

/**
 * plan.md §11.2 rule 3: "Every destructive action needs typed confirmation
 * for irreversible ones (delete product, refund)." No such component
 * exists anywhere in this app yet — `docs/implemented-plan.md` §6.3
 * explicitly notes Products has "no product-delete UI" at all, so there was
 * no precedent to reuse. A plain overlay + centred panel, styled with the
 * same bordered/no-shadow/no-rounded-corners language `Panel.tsx` already
 * establishes, requiring the caller-provided `confirmText` to be typed
 * exactly before the confirm button enables.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  isPending = false,
}: {
  open: boolean;
  title: string;
  description: string;
  /** The exact string the admin must type to enable the confirm button —
   *  e.g. the discount's own code or name, so a stray click can't delete
   *  the wrong row. */
  confirmText: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  const [typed, setTyped] = useState('');

  if (!open) return null;

  const matches = typed === confirmText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-16">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-[420px] border border-line bg-paper">
        <div className="border-b border-line px-16 py-12">
          <h2 id="confirm-dialog-title" className="text-label font-semibold uppercase tracking-label text-ink">
            {title}
          </h2>
        </div>
        <div className="flex flex-col gap-12 p-16">
          <p className="text-body-sm text-ink-70">{description}</p>
          <p className="text-body-sm text-ink">
            Type <span className="font-semibold text-danger">{confirmText}</span> to confirm.
          </p>
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            aria-label={`Type ${confirmText} to confirm`}
            className="h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
            autoFocus
          />
          <div className="flex justify-end gap-8">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={!matches || isPending}
              className="!bg-danger hover:!bg-danger/80"
            >
              {isPending ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
