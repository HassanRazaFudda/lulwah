'use client';

import type { ReactNode } from 'react';
import { isForbiddenError } from '../../lib/api-client';
import { AccessDenied } from '../AccessDenied';
import { Skeleton } from '../Skeleton';

export interface ReportStateGateProps {
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  skeletonRows?: number;
  children: ReactNode;
}

/**
 * Shared loading/error handling for every report panel — every
 * `GET /admin/reports/*` call requires `reports.read` (`report.policy.ts`),
 * so every panel can hit the exact same 403 in the exact same way. Skeleton
 * rows, not a spinner, per plan.md §11.2 rule 1.
 */
export function ReportStateGate({ isLoading, error, onRetry, skeletonRows = 6, children }: ReportStateGateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} className="h-[36px]" />
        ))}
      </div>
    );
  }

  if (error) {
    if (isForbiddenError(error)) {
      return <AccessDenied permission="reports.read" description="Reports are restricted." />;
    }
    return (
      <div className="flex flex-col items-start gap-8 border border-line bg-paper p-16">
        <p className="text-body-sm text-danger">
          {error instanceof Error ? error.message : 'Failed to load this report.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="text-body-sm font-semibold text-zamurrad underline underline-offset-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
