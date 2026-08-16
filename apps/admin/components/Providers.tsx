'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Client-side app shell — plan.md §4.1 picks TanStack Query for
 * server-data caching/optimistic updates across the admin console (the
 * Orders table and the order-detail status mutation both read from this
 * provider via `lib/queries.ts`). One `QueryClient` per browser session,
 * created lazily inside `useState` rather than at module scope so it can't
 * leak state across requests if this ever runs somewhere multi-tenant.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
