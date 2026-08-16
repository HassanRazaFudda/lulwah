'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '@lulwah/ui';

export interface DataTableColumn<T> {
  /** Unique within the table; also the sort key passed to `onSortChange`. */
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Present only on sortable columns — clicking the header calls `onSortChange(column.id)`. */
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableSort {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sort?: DataTableSort | null;
  onSortChange?: (columnId: string) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

/**
 * Reusable dense table — plan.md §11.2 rule 4: "Every table: sticky header,
 * column visibility control, saved views, keyboard row navigation..." This
 * skeleton implements the sticky header, typed column defs, sort and
 * row-click/keyboard-activation; column visibility and saved views are
 * left as a follow-up (noted, not built, per the task's "structure is what
 * matters" scope). Used by Orders today; `columns`/`rows` are generic so
 * Products (and the order-detail items panel) can reuse it unchanged.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  sort,
  onSortChange,
  onRowClick,
  emptyMessage = 'No results.',
}: DataTableProps<T>) {
  return (
    <div className="max-h-[70vh] overflow-auto border border-line">
      <table className="w-full border-collapse text-body-sm">
        <thead className="sticky top-0 z-10 bg-nacre">
          <tr>
            {columns.map((col) => (
              <TableHeaderCell key={col.id} column={col} sort={sort} onSortChange={onSortChange} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-16 py-32 text-center text-body-sm text-ink-70">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <TableRow key={getRowId(row)} row={row} columns={columns} onRowClick={onRowClick} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TableHeaderCell<T>({
  column,
  sort,
  onSortChange,
}: {
  column: DataTableColumn<T>;
  // `| undefined` spelled out — these are fed straight from `DataTable`'s
  // own optional props under `exactOptionalPropertyTypes` (plan.md §27.1).
  sort?: DataTableSort | null | undefined;
  onSortChange?: ((columnId: string) => void) | undefined;
}) {
  const isSorted = sort?.columnId === column.id;
  return (
    <th
      scope="col"
      className={cx(
        'whitespace-nowrap border-b border-line px-16 py-8 text-left text-label font-semibold uppercase tracking-label text-ink-70',
        column.align === 'right' && 'text-right',
        column.align === 'center' && 'text-center',
        column.sortable && 'cursor-pointer select-none hover:text-ink',
      )}
      onClick={column.sortable ? () => onSortChange?.(column.id) : undefined}
      aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {column.header}
      {isSorted ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : null}
    </th>
  );
}

function TableRow<T>({
  row,
  columns,
  onRowClick,
}: {
  row: T;
  columns: DataTableColumn<T>[];
  onRowClick?: ((row: T) => void) | undefined;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <tr
      className={cx('border-b border-line', onRowClick && 'cursor-pointer hover:bg-nacre')}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onKeyDown={onRowClick ? handleKeyDown : undefined}
    >
      {columns.map((col) => (
        <td
          key={col.id}
          className={cx(
            'px-16 py-8 align-middle',
            col.align === 'right' && 'text-right',
            col.align === 'center' && 'text-center',
          )}
        >
          {col.cell(row)}
        </td>
      ))}
    </tr>
  );
}
