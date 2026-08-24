'use client';

import { cx } from '@lulwah/ui';

export interface TabDef {
  id: string;
  label: string;
  disabled?: boolean;
}

/** Tab nav for the product editor — plain buttons, dense underline style
 *  matching the console's "tool, not storefront" language (plan.md §11).
 *  Disabled tabs (Media/Variants/Inventory before a new product has been
 *  saved once) render greyed-out with `aria-disabled` rather than being
 *  hidden, so the full editor structure is visible from the first
 *  keystroke on a new product. */
export function EditorTabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Product editor sections" className="flex flex-wrap gap-4 border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-disabled={tab.disabled}
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          className={cx(
            'h-[40px] border-b-2 px-16 text-body-sm font-semibold transition-colors duration-fast ease-out',
            tab.disabled
              ? 'cursor-not-allowed border-transparent text-ink-20'
              : active === tab.id
                ? 'border-zamurrad text-zamurrad'
                : 'border-transparent text-ink-70 hover:text-ink',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
