'use client';

import { useCallback, useRef, useState } from 'react';
import { cx } from '@lulwah/ui';

/**
 * A minimal toast — plan.md §11.2 rule 2: "optimistic updates on toggles
 * and inline edits, with rollback + toast on failure." No toast primitive
 * exists anywhere in this app yet (`@lulwah/ui` only has `Button`/`Input`;
 * every other screen's mutation errors so far render as inline `<p
 * className="text-danger">` text — `ProductEditor`'s `saveError`,
 * `InventoryAdjustForm`'s `adjustStock.isError`). This screen keeps that
 * inline-error convention for its own Save/Create flow (matching the
 * established pattern exactly, per this task's brief), but the rule above
 * specifically calls out toggles — a transient, table-row-level action with
 * no dedicated error real-estate to render inline text into — so this
 * small, self-contained toast host exists for exactly that case (and the
 * bulk-code-generation summary, which is similarly transient). Deliberately
 * NOT wired into the root layout/`Providers.tsx` — each screen that needs
 * toasts owns its own `useToastState()` instance and renders `<ToastStack>`
 * in its own tree, so this doesn't touch shared app-shell files other
 * in-flight workstreams may also be editing.
 */
export interface ToastMessage {
  id: number;
  tone: 'success' | 'danger';
  text: string;
}

export function useToastState() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const push = useCallback((text: string, tone: ToastMessage['tone'] = 'danger') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, tone, text }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-16 right-16 z-50 flex flex-col gap-8">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={cx(
            'flex items-center gap-16 border px-16 py-12 text-body-sm shadow-none',
            toast.tone === 'danger' ? 'border-danger/40 bg-paper text-danger' : 'border-success/40 bg-paper text-success',
          )}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} className="text-ink-70 hover:text-ink" aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
