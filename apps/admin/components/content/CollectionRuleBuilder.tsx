'use client';

import type { CollectionRule, CollectionRuleField, CollectionRuleOperator } from '@lulwah/contracts';
import { Input } from '@lulwah/ui';
import { labelClassName, selectClassName } from '../product-editor/field-styles';

const FIELDS: CollectionRuleField[] = [
  'brandId',
  'categoryId',
  'stitchingType',
  'fabric',
  'work',
  'occasion',
  'colorFamily',
  'priceFils',
  'onSale',
  'inStock',
];
const OPERATORS: CollectionRuleOperator[] = ['eq', 'in', 'gte', 'lte', 'contains'];
const BOOLEAN_FIELDS: CollectionRuleField[] = ['onSale', 'inStock'];
const NUMBER_FIELDS: CollectionRuleField[] = ['priceFils'];

function valueToInputText(value: CollectionRule['value']): string {
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/**
 * plan.md §11.1: "rule builder for automated collections." `rules[]`
 * (`@lulwah/contracts`' `collection.ts`) is `{ field, operator, value }`
 * with `field` restricted to an allowlist `collection.rules.ts` (catalog)
 * translates into a real product filter — not an arbitrary query builder.
 * `value` is a union (`string | number | boolean | string[]`); this editor
 * picks the right input per field/operator rather than one generic text
 * box, so a rule like `priceFils gte 50000` or `onSale eq true` round-trips
 * as the correct JS type, not a string the server would reject.
 */
export function CollectionRuleBuilder({
  rules,
  onChange,
}: {
  rules: CollectionRule[];
  onChange: (next: CollectionRule[]) => void;
}) {
  const update = (index: number, patch: Partial<CollectionRule>) =>
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-12">
      <span className={labelClassName}>Rules — a product must match every rule below to be included</span>
      {rules.length === 0 ? <p className="text-body-sm text-ink-70">No rules yet — an automated collection with no rules matches nothing.</p> : null}
      {rules.map((rule, index) => {
        const isBoolean = BOOLEAN_FIELDS.includes(rule.field);
        const isNumber = NUMBER_FIELDS.includes(rule.field);
        const isList = rule.operator === 'in';
        return (
          <div key={index} className="flex flex-wrap items-end gap-8 border border-line p-12">
            <div className="flex flex-col gap-4">
              <span className={labelClassName}>Field</span>
              <select
                className={selectClassName}
                value={rule.field}
                onChange={(e) => update(index, { field: e.target.value as CollectionRuleField, value: '' })}
              >
                {FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-4">
              <span className={labelClassName}>Operator</span>
              <select
                className={selectClassName}
                value={rule.operator}
                onChange={(e) => update(index, { operator: e.target.value as CollectionRuleOperator })}
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-4">
              {isBoolean ? (
                <>
                  <span className={labelClassName}>Value</span>
                  <select
                    className={selectClassName}
                    value={String(rule.value)}
                    onChange={(e) => update(index, { value: e.target.value === 'true' })}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </>
              ) : isList ? (
                <Input
                  label="Value — comma-separated"
                  value={valueToInputText(rule.value)}
                  onChange={(e) =>
                    update(index, { value: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })
                  }
                />
              ) : (
                <Input
                  label="Value"
                  type={isNumber ? 'number' : 'text'}
                  value={valueToInputText(rule.value)}
                  onChange={(e) => update(index, { value: isNumber ? Number(e.target.value) || 0 : e.target.value })}
                />
              )}
            </div>
            <button
              type="button"
              className="text-body-sm text-danger hover:underline"
              onClick={() => onChange(rules.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="self-start text-body-sm font-semibold text-zamurrad hover:underline"
        onClick={() => onChange([...rules, { field: 'inStock', operator: 'eq', value: true }])}
      >
        + Add rule
      </button>
    </div>
  );
}
