'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';

/**
 * plan.md §12.3: "TanStack Query for cart... optimistic with rollback."
 * One `QueryClient` per browser tab (not per render) — the classic App
 * Router pattern: create it lazily inside `useState` so a server render
 * never shares a client-cached instance across requests/users.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // A validation/business-rule rejection (e.g. `COUPON_INVALID`,
          // `OUT_OF_STOCK`) will never succeed by retrying — only retry
          // genuine transport/unknown failures, and only twice.
          if (error instanceof ApiError && error.code !== 'UNKNOWN_RESPONSE_SHAPE' && error.code !== 'SERVICE_UNAVAILABLE') {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
