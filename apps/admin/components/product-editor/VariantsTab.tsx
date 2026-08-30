'use client';

import { useMemo, useState } from 'react';
import { Size } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { buildVariantMatrix } from '../../lib/product-editor';
import type { VariantMatrixRow } from '../../lib/product-editor';
import {
  useCreateVariantMutation,
  useDeleteVariantMutation,
  useUpdateVariantMutation,
} from '../../lib/queries/products';
import type { AdminVariantWithStock } from '../../lib/queries/products';
import { MultiCheckList } from './MultiCheckList';
import { MoneyInput } from './MoneyInput';
import { selectClassName } from './field-styles';

const SIZE_OPTIONS = Size.options.map((s) => ({ value: s, label: s }));

/**
 * plan.md §11.1 Variants tab: "a size×colour matrix generator where
 * relevant" — not every product needs both axes (a single ready-to-wear
 * piece might need neither), so the generator is opt-in: pick the axes
 * that apply, generate a preview, edit price/SKU/weight per row, then
 * submit. Backed by the real `/variants` endpoints
 * (`variant.controller.ts`) — each preview row becomes one
 * `POST .../variants` call. Existing variants below are separately
 * editable/deletable in place via the same endpoints.
 */
export function VariantsTab({
  productId,
  articleCode,
  basePriceFils,
  variants,
}: {
  productId: string;
  articleCode: string;
  basePriceFils: number;
  variants: AdminVariantWithStock[];
}) {
  const [sizes, setSizes] = useState<string[]>([]);
  const [colorsText, setColorsText] = useState('');
  const [weightGrams, setWeightGrams] = useState(300);
  const [draftRows, setDraftRows] = useState<VariantMatrixRow[] | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const createVariant = useCreateVariantMutation(productId);

  const colorNames = useMemo(
    () => colorsText.split(',').map((c) => c.trim()).filter(Boolean),
    [colorsText],
  );

  const generate = () => {
    setDraftRows(
      buildVariantMatrix({
        skuBase: articleCode || 'SKU',
        sizes: sizes as Size[],
        colors: colorNames.map((name) => ({ name })),
        basePriceFils,
        weightGrams,
      }),
    );
    setCreateError(null);
  };

  const updateDraftRow = (index: number, patch: Partial<VariantMatrixRow>) => {
    setDraftRows((rows) => (rows ? rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) : rows));
  };

  const submitDraftRows = async () => {
    if (!draftRows || draftRows.length === 0) return;
    setCreating(true);
    setCreateError(null);
    let failures = 0;
    for (const row of draftRows) {
      try {
        await createVariant.mutateAsync({
          sku: row.sku,
          options: { ...(row.size ? { size: row.size } : {}), ...(row.color ? { color: row.color } : {}) },
          priceFils: row.priceFils,
          weightGrams: row.weightGrams,
          initialOnHand: 0,
        });
      } catch (err) {
        failures += 1;
        if (err instanceof Error) setCreateError((prev) => (prev ? `${prev}; ${err.message}` : err.message));
      }
    }
    setCreating(false);
    if (failures === 0) setDraftRows(null);
  };

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-12 border border-line bg-nacre p-16">
        <p className="text-body-sm font-semibold text-ink">Generate variants</p>
        <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <span className="text-label uppercase tracking-label text-ink-70">Sizes</span>
            <MultiCheckList options={SIZE_OPTIONS} selected={sizes} onChange={setSizes} />
          </div>
          <div className="flex flex-col gap-12">
            <Input
              label="Colours — comma-separated, optional"
              hint="e.g. Ferozi, Off White, Maroon"
              value={colorsText}
              onChange={(e) => setColorsText(e.target.value)}
            />
            <div className="flex flex-col gap-4">
              <span className="text-label uppercase tracking-label text-ink-70">Default weight (grams)</span>
              <input
                type="number"
                min={1}
                className={selectClassName}
                value={weightGrams}
                onChange={(e) => setWeightGrams(Number(e.target.value) || 1)}
              />
            </div>
          </div>
        </div>
        <div>
          <Button type="button" variant="secondary" onClick={generate}>
            Generate matrix preview
          </Button>
        </div>

        {draftRows ? (
          <div className="flex flex-col gap-8">
            <div className="max-h-[280px] overflow-y-auto border border-line">
              <table className="w-full border-collapse text-body-sm">
                <thead className="bg-paper">
                  <tr>
                    <th className="border-b border-line px-8 py-4 text-left">Size</th>
                    <th className="border-b border-line px-8 py-4 text-left">Colour</th>
                    <th className="border-b border-line px-8 py-4 text-left">SKU</th>
                    <th className="border-b border-line px-8 py-4 text-right">Price (AED)</th>
                    <th className="border-b border-line px-8 py-4 text-right">Weight (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {draftRows.map((row, i) => (
                    <tr key={i} className="border-b border-line">
                      <td className="px-8 py-4">{row.size ?? '—'}</td>
                      <td className="px-8 py-4">{row.color ?? '—'}</td>
                      <td className="px-8 py-4">
                        <input
                          className="h-[32px] w-full border border-line bg-paper px-8 text-body-sm"
                          value={row.sku}
                          onChange={(e) => updateDraftRow(i, { sku: e.target.value })}
                        />
                      </td>
                      <td className="px-8 py-4 text-right">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="h-[32px] w-[100px] border border-line bg-paper px-8 text-right text-body-sm"
                          value={(row.priceFils / 100).toFixed(2)}
                          onChange={(e) => updateDraftRow(i, { priceFils: Math.round(Number(e.target.value) * 100) })}
                        />
                      </td>
                      <td className="px-8 py-4 text-right">
                        <input
                          type="number"
                          min={1}
                          className="h-[32px] w-[80px] border border-line bg-paper px-8 text-right text-body-sm"
                          value={row.weightGrams}
                          onChange={(e) => updateDraftRow(i, { weightGrams: Number(e.target.value) || 1 })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {createError ? <p className="text-body-sm text-danger">{createError}</p> : null}
            <div className="flex gap-8">
              <Button type="button" onClick={() => void submitDraftRows()} disabled={creating}>
                {creating ? 'Creating…' : `Create ${draftRows.length} variant${draftRows.length === 1 ? '' : 's'}`}
              </Button>
              <Button type="button" variant="tertiary" onClick={() => setDraftRows(null)}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-8">
        <p className="text-body-sm font-semibold text-ink">Existing variants ({variants.length})</p>
        {variants.length === 0 ? (
          <p className="text-body-sm text-ink-70">No variants yet — generate some above.</p>
        ) : (
          <div className="flex flex-col gap-8">
            {variants.map((variant) => (
              <VariantRow key={variant.id} productId={productId} variant={variant} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VariantRow({ productId, variant }: { productId: string; variant: AdminVariantWithStock }) {
  const [sku, setSku] = useState(variant.sku);
  const [priceFils, setPriceFils] = useState(variant.priceFils);
  const [weightGrams, setWeightGrams] = useState(variant.weightGrams);
  const [isActive, setIsActive] = useState(variant.isActive);
  const updateVariant = useUpdateVariantMutation(productId);
  const deleteVariant = useDeleteVariantMutation(productId);

  const dirty = sku !== variant.sku || priceFils !== variant.priceFils || weightGrams !== variant.weightGrams || isActive !== variant.isActive;

  return (
    <div className="flex flex-wrap items-end gap-12 border border-line bg-paper p-12">
      <div className="text-body-sm text-ink-70">
        {[variant.options.size, variant.options.color].filter(Boolean).join(' / ') || 'Base variant'}
        <br />
        <span className="text-label uppercase tracking-label">On hand: {variant.onHand} · Available: {variant.available}</span>
      </div>
      <div className="flex flex-col gap-4">
        <span className="text-label uppercase tracking-label text-ink-70">SKU</span>
        <input className="h-[36px] border border-line bg-paper px-8 text-body-sm" value={sku} onChange={(e) => setSku(e.target.value)} />
      </div>
      <MoneyInput label="Price (AED)" valueFils={priceFils} onChange={(v) => setPriceFils(v ?? 0)} />
      <div className="flex flex-col gap-4">
        <span className="text-label uppercase tracking-label text-ink-70">Weight (g)</span>
        <input
          type="number"
          min={1}
          className="h-[36px] w-[80px] border border-line bg-paper px-8 text-body-sm"
          value={weightGrams}
          onChange={(e) => setWeightGrams(Number(e.target.value) || 1)}
        />
      </div>
      <label className="flex items-center gap-8 text-body-sm text-ink">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
      <div className="flex gap-8">
        <Button
          type="button"
          variant="secondary"
          disabled={!dirty || updateVariant.isPending}
          onClick={() => updateVariant.mutate({ variantId: variant.id, input: { sku, priceFils, weightGrams, isActive } })}
        >
          {updateVariant.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          disabled={deleteVariant.isPending}
          onClick={() => {
            if (window.confirm(`Delete variant ${variant.sku}? This also removes its inventory record.`)) {
              deleteVariant.mutate(variant.id);
            }
          }}
        >
          Delete
        </Button>
      </div>
      {updateVariant.isError ? <p className="w-full text-body-sm text-danger">{updateVariant.error.message}</p> : null}
      {deleteVariant.isError ? <p className="w-full text-body-sm text-danger">{deleteVariant.error.message}</p> : null}
    </div>
  );
}
