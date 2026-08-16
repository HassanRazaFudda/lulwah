'use client';

import { parseAsInteger, useQueryState } from 'nuqs';
import { Button } from '@lulwah/ui';

/**
 * plan.md §15.3: "Pagination: 'Load more' button (not infinite scroll —
 * it breaks the footer and hurts SEO), with real ?page= URLs and
 * rel=next/prev for crawlers." The page Server Component reads `page`
 * from `searchParams` and renders `products.slice(0, page * PAGE_SIZE)` —
 * a real, shareable, cumulative `?page=N` URL (§12.3: "URL is the source
 * of truth for filters, sort and pagination", via `nuqs`) rather than a
 * client-only fetch-and-append.
 */
export interface LoadMoreButtonProps {
  remainingCount: number;
}

export function LoadMoreButton({ remainingCount }: LoadMoreButtonProps) {
  const [, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

  return (
    <div className="flex justify-center pt-16">
      <Button type="button" variant="secondary" onClick={() => void setPage((current) => current + 1)}>
        Load more ({remainingCount})
      </Button>
    </div>
  );
}
