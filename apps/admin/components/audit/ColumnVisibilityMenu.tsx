'use client';

export interface ColumnOption {
  id: string;
  label: string;
}

export interface ColumnVisibilityMenuProps {
  options: ColumnOption[];
  visible: Set<string>;
  onToggle: (id: string) => void;
}

/** plan.md §11.2 rule 4: "Every table: sticky header, column visibility
 *  control..." — a plain native `<details>` disclosure rather than a new
 *  popover primitive, since `@lulwah/ui` has no dropdown/menu component
 *  yet (only `Button`/`Input`, per that package's own file list). Audit
 *  log is the one table in this app wide enough (11 possible columns) to
 *  need this — Orders/Products/Inventory's tables all fit comfortably. */
export function ColumnVisibilityMenu({ options, visible, onToggle }: ColumnVisibilityMenuProps) {
  return (
    <details className="relative">
      <summary className="flex h-[40px] cursor-pointer list-none items-center border border-line bg-paper px-16 text-body-sm text-ink-70 hover:text-ink [&::-webkit-details-marker]:hidden">
        Columns
      </summary>
      <div className="absolute right-0 z-20 mt-4 flex min-w-[180px] flex-col gap-8 border border-line bg-paper p-12">
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-8 text-body-sm text-ink">
            <input type="checkbox" checked={visible.has(option.id)} onChange={() => onToggle(option.id)} />
            {option.label}
          </label>
        ))}
      </div>
    </details>
  );
}
