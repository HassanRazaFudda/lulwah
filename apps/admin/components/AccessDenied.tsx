export interface AccessDeniedProps {
  /** The exact permission string the backend requires — shown verbatim so
   *  whoever hits this knows precisely what to ask for, not a vague
   *  "contact your admin." */
  permission: string;
  description?: string;
}

/**
 * Shown in place of a screen's real content when the API rejects the
 * request with a 403 (`isForbiddenError` in `lib/api-client.ts`) — i.e. the
 * logged-in admin is authenticated but genuinely lacks the permission,
 * per plan.md §10.2's real RBAC enforcement. Deliberately not a full error
 * page or a raw `ApiClientError` dump: this is an expected, well-defined
 * state (Reports' `reports.read` and Audit log's `audit.read` are both
 * granted to only a subset of roles — see `audit.policy.ts`'s own doc
 * comment on exactly why), not a bug, so it reads like one.
 */
export function AccessDenied({ permission, description }: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 border border-line bg-paper px-24 py-48 text-center">
      <p className="text-label font-semibold uppercase tracking-label text-danger">Access restricted</p>
      <p className="max-w-[420px] text-body-sm text-ink-70">
        {description ?? "You don't have access to this screen."} Requires the{' '}
        <code className="rounded-sm bg-pearl px-4 py-2 text-[12px]">{permission}</code> permission. Ask a manager or
        super admin to grant it if you need it.
      </p>
    </div>
  );
}
