'use client';

import { ColorFamily, DupattaType, Fabric, Occasion, Season, StitchingType, Work } from '@lulwah/contracts';
import type { PieceCount } from '@lulwah/contracts';
import { Input, Button } from '@lulwah/ui';
import type { ProductDraft } from '../../lib/product-draft';
import { defaultPiecesForCount } from '../../lib/product-editor';
import { MultiCheckList } from './MultiCheckList';
import { PiecesEditor } from './PiecesEditor';
import { labelClassName, selectClassName } from './field-styles';

const OCCASION_OPTIONS = Occasion.options.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }));
const FABRIC_OPTIONS = Fabric.options.map((f) => ({ value: f, label: f.replace(/_/g, ' ') }));
const WORK_OPTIONS = Work.options.map((w) => ({ value: w, label: w.replace(/_/g, ' ') }));

/**
 * plan.md §2 / §11.1 "Pakistani attributes" — the tab that matters most for
 * this task: stitching type, piece count + the per-piece builder, fabric,
 * work, dupatta type, occasion, season, colour. Every option list comes
 * from `@lulwah/contracts`' enums (`StitchingType`, `Fabric`, `Occasion`,
 * `Season`, `ColorFamily`, `DupattaType`) via `.options`, never a
 * hand-rolled second copy — a value added to the API's enum shows up here
 * automatically, exactly as the brief requires.
 */
export function AttributesTab({ draft, onChange }: { draft: ProductDraft; onChange: (next: ProductDraft) => void }) {
  const handlePieceCountChange = (value: string) => {
    const pieceCount = value === '' ? null : ((Number(value) as PieceCount) ?? null);
    onChange({ ...draft, pieceCount });
  };

  const regeneratePieces = () => {
    onChange({ ...draft, pieces: defaultPiecesForCount(draft.pieceCount, draft.fabric) });
  };

  return (
    <div className="flex flex-col gap-24">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Stitching type</span>
          <select
            className={selectClassName}
            value={draft.stitchingType}
            onChange={(e) => onChange({ ...draft, stitchingType: e.target.value as typeof draft.stitchingType })}
          >
            {StitchingType.options.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Piece count</span>
          <select className={selectClassName} value={draft.pieceCount ?? ''} onChange={(e) => handlePieceCountChange(e.target.value)}>
            <option value="">Not applicable</option>
            <option value="1">1 piece</option>
            <option value="2">2 piece</option>
            <option value="3">3 piece</option>
          </select>
        </div>

        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Primary fabric</span>
          <select className={selectClassName} value={draft.fabric} onChange={(e) => onChange({ ...draft, fabric: e.target.value as Fabric })}>
            {Fabric.options.map((f) => (
              <option key={f} value={f}>
                {f.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <span className={labelClassName}>Pieces</span>
          <Button type="button" variant="tertiary" onClick={regeneratePieces} disabled={draft.pieceCount === null}>
            Auto-generate from piece count
          </Button>
        </div>
        <PiecesEditor pieces={draft.pieces} onChange={(pieces) => onChange({ ...draft, pieces })} />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Secondary fabrics</span>
          <MultiCheckList
            options={FABRIC_OPTIONS}
            selected={draft.secondaryFabrics}
            onChange={(secondaryFabrics) => onChange({ ...draft, secondaryFabrics: secondaryFabrics as Fabric[] })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Work</span>
          <MultiCheckList options={WORK_OPTIONS} selected={draft.work} onChange={(work) => onChange({ ...draft, work: work as typeof draft.work })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Dupatta</span>
          <select
            className={selectClassName}
            value={draft.dupattaType ?? ''}
            onChange={(e) => onChange({ ...draft, dupattaType: e.target.value === '' ? null : (e.target.value as DupattaType) })}
          >
            <option value="">Not set</option>
            {DupattaType.options.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Season</span>
          <select className={selectClassName} value={draft.season} onChange={(e) => onChange({ ...draft, season: e.target.value as typeof draft.season })}>
            {Season.options.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Colour family</span>
          <select
            className={selectClassName}
            value={draft.colorFamily}
            onChange={(e) => onChange({ ...draft, colorFamily: e.target.value as ColorFamily })}
          >
            {ColorFamily.options.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <span className={labelClassName}>Occasion</span>
        <MultiCheckList
          options={OCCASION_OPTIONS}
          selected={draft.occasion}
          onChange={(occasion) => onChange({ ...draft, occasion: occasion as typeof draft.occasion })}
        />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <Input label="Colour name" value={draft.colorName} onChange={(e) => onChange({ ...draft, colorName: e.target.value })} />
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Colour swatch</span>
          <div className="flex items-center gap-8">
            <input
              type="color"
              value={draft.colorHex}
              onChange={(e) => onChange({ ...draft, colorHex: e.target.value })}
              className="h-[40px] w-[52px] cursor-pointer border border-line bg-paper"
            />
            <input
              value={draft.colorHex}
              onChange={(e) => onChange({ ...draft, colorHex: e.target.value })}
              className={selectClassName}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-4">
        <Input
          label="Neckline — optional"
          value={draft.neckline ?? ''}
          onChange={(e) => onChange({ ...draft, neckline: e.target.value || null })}
        />
        <Input
          label="Sleeve length — optional"
          value={draft.sleeveLength ?? ''}
          onChange={(e) => onChange({ ...draft, sleeveLength: e.target.value || null })}
        />
        <Input
          label="Shirt length — optional"
          value={draft.shirtLength ?? ''}
          onChange={(e) => onChange({ ...draft, shirtLength: e.target.value || null })}
        />
        <Input label="Fit — optional" value={draft.fit ?? ''} onChange={(e) => onChange({ ...draft, fit: e.target.value || null })} />
      </div>
    </div>
  );
}
