import { NextResponse } from 'next/server';

/**
 * Trivial BFF route handler — plan.md §5.2: "The storefront never calls
 * the API directly from the browser for authenticated work. It calls
 * Next.js Route Handlers (`/api/bff/*`)... Public read endpoints... are
 * called directly from RSC on the server, cached by ISR." This just
 * proves the plumbing: it reports whether `API_INTERNAL_URL` (the
 * Docker-network address §5.1's `api` container would be reachable at) is
 * configured, without calling a live `apps/api` — that wiring belongs to
 * the API workstream.
 */
export async function GET() {
  const apiInternalUrl = process.env.API_INTERNAL_URL ?? null;
  const apiPublicUrl = process.env.NEXT_PUBLIC_API_URL ?? null;

  return NextResponse.json({
    success: true,
    data: {
      service: '@lulwah/web',
      status: 'ok',
      apiInternalConfigured: apiInternalUrl !== null,
      apiPublicConfigured: apiPublicUrl !== null,
      timestamp: new Date().toISOString(),
    },
  });
}
