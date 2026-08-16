'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * plan.md §15.1: "rotating messages ..., 5s each, pausable, dismissible for
 * the session. Emerald background, paper text, label type." Dismissal is
 * per-`sessionStorage`, not per-cookie — it should come back on the next
 * visit, just not for the rest of this session.
 */
const ROTATION_MS = 5000;
const SESSION_KEY = 'lulwah-announcement-dismissed';
const MESSAGE_KEYS = ['freeShipping', 'delivery', 'cod'] as const;

export function AnnouncementBar() {
  const t = useTranslations('announcement');
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsDismissed(sessionStorage.getItem(SESSION_KEY) === '1');
  }, []);

  useEffect(() => {
    if (isPaused || isDismissed) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGE_KEYS.length);
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, isDismissed]);

  if (isDismissed) return null;

  // `noUncheckedIndexedAccess`: indexing a const tuple with a variable
  // still types as `T | undefined`, even though the modulo above keeps it
  // in range — the fallback is unreachable, just satisfies the compiler.
  const messageKey = MESSAGE_KEYS[index] ?? MESSAGE_KEYS[0];

  return (
    <div
      className="relative flex items-center justify-center bg-zamurrad px-24 py-8 text-paper"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label={t('label')}
    >
      <p className="font-body text-label font-semibold tracking-label uppercase" aria-live="polite">
        {t(messageKey)}
      </p>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(SESSION_KEY, '1');
          setIsDismissed(true);
        }}
        aria-label={t('dismiss')}
        className="absolute end-16 top-1/2 inline-flex -translate-y-1/2 items-center justify-center"
      >
        <X size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
