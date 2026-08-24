'use client';

import { cx } from '@lulwah/ui';

export interface MultiCheckOption {
  value: string;
  label: string;
  /** Indent level for tree-shaped data (categories) — applied as an inline
   *  `paddingLeft`, not a Tailwind class, so it isn't bound by
   *  `@lulwah/config`'s locked spacing scale (plan.md-doc §8.1's bug class)
   *  for an arbitrary per-depth value. */
  indent?: number;
}

/**
 * A checkbox list standing in for a searchable multi-select combobox —
 * every array-of-enum field in the product editor (categories, collections,
 * work[], occasion[], secondaryFabrics[], badges[]) needs the same "toggle
 * membership in a string[]" interaction. `@lulwah/ui` has no Select/Combobox
 * primitive yet (only `Button`/`Input` — see `docs/implemented-plan.md`
 * §3), and 46 categories / a dozen enum members comfortably fit a scrolling
 * checkbox panel without needing to build search-as-you-type for this pass.
 */
export function MultiCheckList({
  options,
  selected,
  onChange,
  className,
}: {
  options: MultiCheckOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className={cx('flex max-h-[240px] flex-col gap-4 overflow-y-auto border border-line bg-paper p-12', className)}>
      {options.length === 0 ? <p className="text-body-sm text-ink-70">Nothing to choose from yet.</p> : null}
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-8 text-body-sm text-ink"
          style={opt.indent ? { paddingLeft: opt.indent * 16 } : undefined}
        >
          <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
