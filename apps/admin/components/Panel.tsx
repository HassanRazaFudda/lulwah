import type { ReactNode } from 'react';
import { cx } from '@lulwah/ui';

export interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** The one bordered-section shape used across Dashboard and Order detail —
 *  dense tool chrome: a hairline border, a small uppercase tracked title,
 *  no shadow, no rounded corners beyond the system's 2px radius. */
export function Panel({ title, actions, children, className }: PanelProps) {
  return (
    <section className={cx('border border-line bg-paper', className)}>
      {title ? (
        <header className="flex items-center justify-between border-b border-line px-16 py-12">
          <h2 className="text-label font-semibold uppercase tracking-label text-ink-70">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className="p-16">{children}</div>
    </section>
  );
}
