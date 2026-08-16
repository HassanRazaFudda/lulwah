import { cx } from '@lulwah/ui';

export interface SkeletonProps {
  className?: string;
}

/**
 * plan.md §11.2 rule 1: "Never a full-page spinner. Skeletons matching the
 * final layout." A single pulsing block; call sites compose it into
 * table-row/tile shapes that mirror what actually renders once data
 * arrives, rather than a generic centred spinner.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cx('animate-pulse rounded-sm bg-pearl', className)} />;
}
