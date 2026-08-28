'use client';

import { useState } from 'react';
import { Button, Input } from '@lulwah/ui';

export interface TypedConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** The exact string the operator must retype before the confirm button
   *  enables — plan.md §11.2 rule 3: "Every destructive action needs typed
   *  confirmation for irreversible ones." No such component existed
   *  anywhere in this app before this task (the one precedent,
   *  `VariantsTab.tsx`'s delete-variant action, uses a plain
   *  `window.confirm()`) — this is the first real one, built for Content's
   *  delete-banner/page/menu/collection actions and reusable elsewhere. */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
  errorMessage?: string | null;
}

export function TypedConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  isPending = false,
  errorMessage = null,
}: TypedConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  if (!open) return null;

  const matches = typed.trim() === confirmLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-16" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex w-full max-w-[440px] flex-col gap-16 border border-line bg-paper p-24">
        <div>
          <h2 className="text-heading-3 font-semibold text-ink">{title}</h2>
          <p className="mt-4 text-body-sm text-ink-70">{description}</p>
        </div>
        <Input
          label={`Type "${confirmLabel}" to confirm`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoFocus
        />
        {errorMessage ? <p className="text-body-sm text-danger">{errorMessage}</p> : null}
        <div className="flex justify-end gap-8">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={!matches || isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}
