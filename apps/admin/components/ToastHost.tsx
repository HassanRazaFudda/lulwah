'use client';

import { useEffect } from 'react';
import { cx } from '@lulwah/ui';
import { useToastStore } from '../lib/stores/toast-store';

const TOAST_TIMEOUT_MS = 5000;

function ToastRow({ id, tone, text }: { id: string; tone: 'success' | 'error'; text: string }) {
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(id), TOAST_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [id, dismiss]);

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-12 border px-16 py-12 text-body-sm shadow-none',
        tone === 'error' ? 'border-danger bg-paper text-danger' : 'border-success bg-paper text-success',
      )}
    >
      <span className="flex-1">{text}</span>
      <button
        type="button"
        onClick={() => dismiss(id)}
        aria-label="Dismiss notification"
        className="text-ink-70 hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}

/** Fixed bottom-right stack, mounted once in `Providers.tsx` — see
 *  `lib/stores/toast-store.ts`'s doc comment for why this exists. */
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-24 z-50 flex w-full max-w-[360px] flex-col gap-8">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastRow {...toast} />
        </div>
      ))}
    </div>
  );
}
