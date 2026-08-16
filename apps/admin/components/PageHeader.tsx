import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/** Consistent header for every dashboard-area screen — title + optional
 *  description + a right-aligned actions slot (bulk buttons, "New" CTA).
 *  One component so the eleven screens in `app/(dashboard)` don't each
 *  reinvent this row. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-16 border-b border-line pb-16">
      <div>
        <h1 className="text-heading-2 font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-4 text-body-sm text-ink-70">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-8">{actions}</div> : null}
    </div>
  );
}
