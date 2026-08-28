'use client';

import type { User } from '@lulwah/contracts';
import { DateRangeFields } from '../DateRangeFields';

const FIELD_CLASSES =
  'h-[40px] border border-line bg-paper px-12 text-body-sm text-ink outline-none focus:border-zamurrad';

export interface AuditFilterState {
  actorId: string;
  entityType: string;
  entityId: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilterState = {
  actorId: '',
  entityType: '',
  entityId: '',
  dateFrom: '',
  dateTo: '',
};

export interface AuditFiltersProps {
  filters: AuditFilterState;
  onChange: (next: AuditFilterState) => void;
  /** `undefined` while `useAdminUsersForAuditQuery` is still loading or
   *  failed — the actor field degrades to a plain ObjectId text input in
   *  that case rather than blocking the rest of the screen on it. */
  users: User[] | undefined;
  entityTypeSuggestions: string[];
}

/** `actorId`/`entityType`/`entityId`/`dateFrom`/`dateTo` — exactly
 *  `AdminListAuditLogQuery` (`audit.dto.ts`), nothing more. `actorId` is
 *  the one field the backend validates as a strict 24-char ObjectId
 *  (`objectId` in `@lulwah/contracts`); `entityType`/`entityId` are plain
 *  strings server-side, so free text is always valid there. */
export function AuditFilters({ filters, onChange, users, entityTypeSuggestions }: AuditFiltersProps) {
  function set<K extends keyof AuditFilterState>(key: K, value: AuditFilterState[K]): void {
    onChange({ ...filters, [key]: value });
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className="flex flex-wrap items-end gap-8">
      <label className="flex items-center gap-8 text-body-sm text-ink-70">
        Actor
        {users && users.length > 0 ? (
          <select value={filters.actorId} onChange={(event) => set('actorId', event.target.value)} className={FIELD_CLASSES}>
            <option value="">All actors</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {`${user.firstName} ${user.lastName}`.trim() || user.email || user.id}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="Actor ID (24-char)"
            value={filters.actorId}
            onChange={(event) => set('actorId', event.target.value)}
            className={FIELD_CLASSES}
          />
        )}
      </label>

      <label className="flex items-center gap-8 text-body-sm text-ink-70">
        Entity type
        <input
          list="audit-entity-type-suggestions"
          type="text"
          placeholder="e.g. orders"
          value={filters.entityType}
          onChange={(event) => set('entityType', event.target.value)}
          className={FIELD_CLASSES}
        />
        <datalist id="audit-entity-type-suggestions">
          {entityTypeSuggestions.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </label>

      <label className="flex items-center gap-8 text-body-sm text-ink-70">
        Entity ID
        <input
          type="text"
          placeholder="ObjectId"
          value={filters.entityId}
          onChange={(event) => set('entityId', event.target.value)}
          className={FIELD_CLASSES}
        />
      </label>

      <DateRangeFields
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onDateFromChange={(value) => set('dateFrom', value)}
        onDateToChange={(value) => set('dateTo', value)}
      />

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_AUDIT_FILTERS)}
          className="h-[40px] px-4 text-body-sm font-semibold text-ink-70 underline underline-offset-4 hover:text-ink"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
