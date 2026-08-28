'use client';

import { labelClassName, selectClassName } from '../product-editor/field-styles';

/** A plain add/remove list of strings — USP bar items, journal teaser
 *  slugs, collection-rule string values. Reuses `product-editor/field-
 *  styles.ts`'s established `<select>`-styled row for a one-line text
 *  input too (same border/height/focus treatment, just applied to a text
 *  `<input>`), matching the app's existing convention of not building a
 *  new input skin per screen. */
export function StringListEditor({
  label,
  values,
  onChange,
  placeholder,
  max,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const atMax = typeof max === 'number' && values.length >= max;
  return (
    <div className="flex flex-col gap-4">
      <span className={labelClassName}>{label}</span>
      {values.length === 0 ? <p className="text-body-sm text-ink-70">None yet.</p> : null}
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-8">
          <input
            className={selectClassName}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(values.map((v, i) => (i === index ? event.target.value : v)))}
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, i) => i !== index))}
            className="whitespace-nowrap text-body-sm text-danger hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={atMax}
        onClick={() => onChange([...values, ''])}
        className="self-start text-body-sm font-semibold text-zamurrad hover:underline disabled:cursor-not-allowed disabled:text-ink-70 disabled:no-underline"
      >
        + Add {atMax ? `(max ${max})` : ''}
      </button>
    </div>
  );
}
