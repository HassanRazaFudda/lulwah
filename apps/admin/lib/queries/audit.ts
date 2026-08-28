import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { AuditLogEntry, User } from '@lulwah/contracts';
import { apiRequest, apiRequestWithMeta } from '../api-client';
import { buildQueryString } from './query-utils';

/**
 * Audit log data-fetching layer — `GET /admin/audit-log`
 * (`apps/api/src/modules/audit/audit.routes.ts`, plan.md §11.1). Filters
 * sent below are exactly `AdminListAuditLogQuery` (`audit.dto.ts`):
 * `actorId`/`entityType`/`entityId`/`dateFrom`/`dateTo`/`page`/`limit` —
 * nothing invented (no `action`/`method`/`statusCode` filter exists
 * server-side, so this screen only ever narrows the fetched page
 * client-side for those, same "server params vs. client-side narrowing"
 * split `queries/orders.ts`/`queries/products.ts` already document for
 * their own screens).
 *
 * Uses `apiRequestWithMeta` (not the usual `apiRequest`) because this is
 * genuinely paginated server-side — audit entries are written for *every*
 * mutating `/admin/*` request across the whole app (`audit-log
 * .middleware.ts`), so unlike Orders'/Inventory's "one generous page is
 * always enough" datasets, this one can realistically exceed a single
 * page during ordinary use.
 */

const AuditLogEnvelope = z.object({ entries: z.array(AuditLogEntry) });

export interface AdminAuditLogFilter {
  actorId?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

const LIMIT = 50;

export function useAdminAuditLogQuery(filter: AdminAuditLogFilter, page: number) {
  return useQuery({
    queryKey: ['admin', 'audit-log', filter, page],
    queryFn: () =>
      apiRequestWithMeta(
        `/admin/audit-log${buildQueryString({
          actorId: filter.actorId,
          entityType: filter.entityType,
          entityId: filter.entityId,
          dateFrom: filter.dateFrom,
          dateTo: filter.dateTo,
          page,
          limit: LIMIT,
        })}`,
        AuditLogEnvelope,
      ).then(({ data, meta }) => ({
        entries: data.entries,
        page: meta?.page ?? page,
        limit: meta?.limit ?? LIMIT,
        total: meta?.total ?? data.entries.length,
        hasMore: meta?.hasMore ?? false,
      })),
    retry: false,
  });
}

const UsersResponse = z.object({ users: z.array(User) });

/**
 * Populates the actor filter's picker with real names/emails instead of
 * a bare ObjectId text box — `GET /admin/users` (`identity.routes.ts`,
 * requires `users.read`). Both roles that can reach this screen at all
 * (`super_admin`/`manager` — `audit.policy.ts`) also hold `users.read`
 * per `identity.policy.ts`'s `ROLE_PERMISSIONS`, so this should always
 * succeed for anyone who gets past the audit-log gate — but it's still a
 * separate, best-effort query: a failure here degrades the actor filter to
 * a plain text input (see `AuditFilters.tsx`) rather than breaking the
 * whole page. `AdminListUsersQuery` has no search param, so this fetches
 * one page (100 — comfortably above this seed data's staff count) and
 * lets the picker itself filter client-side, same "small reference list,
 * one fetch" precedent as `queries/catalog-refs.ts`.
 */
export function useAdminUsersForAuditQuery() {
  return useQuery({
    queryKey: ['admin', 'users', 'for-audit-picker'],
    queryFn: () => apiRequest('/admin/users?limit=100', UsersResponse).then((r) => r.users),
    retry: false,
  });
}
