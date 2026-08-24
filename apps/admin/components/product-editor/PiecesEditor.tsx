'use client';

import { Fabric, Work } from '@lulwah/contracts';
import type { ProductPiece } from '@lulwah/contracts';
import { Button } from '@lulwah/ui';
import { MultiCheckList } from './MultiCheckList';
import { selectClassName } from './field-styles';

const PIECE_TYPES: ProductPiece['type'][] = ['shirt', 'trouser', 'dupatta', 'slip', 'shawl'];
const WORK_OPTIONS = Work.options.map((w) => ({ value: w, label: w.replace(/_/g, ' ') }));

/**
 * The per-piece builder — plan.md §2's "this is the domain-specific part
 * that matters most": a 3-piece unstitched lawn suit has a shirt, trouser
 * and dupatta piece, each with its own fabric/length/work/description.
 * `AttributesTab` seeds this list via `defaultPiecesForCount` (the tested
 * pure function in `lib/product-editor.ts`) when `pieceCount` changes, but
 * every row stays fully editable and rows can be added/removed freely
 * afterwards — the default is a starting point, not a constraint.
 */
export function PiecesEditor({ pieces, onChange }: { pieces: ProductPiece[]; onChange: (next: ProductPiece[]) => void }) {
  const updatePiece = (index: number, patch: Partial<ProductPiece>) => {
    onChange(pieces.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };
  const removePiece = (index: number) => onChange(pieces.filter((_, i) => i !== index));
  const addPiece = () =>
    onChange([...pieces, { type: 'shirt', fabric: 'lawn', lengthMeters: null, work: [], descriptionEn: '', descriptionAr: '' }]);

  return (
    <div className="flex flex-col gap-16">
      {pieces.length === 0 ? <p className="text-body-sm text-ink-70">No pieces yet.</p> : null}
      {pieces.map((piece, index) => (
        <div key={index} className="flex flex-col gap-12 border border-line bg-nacre p-16">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            <div className="flex flex-col gap-4">
              <span className="text-label uppercase tracking-label text-ink-70">Piece type</span>
              <select
                className={selectClassName}
                value={piece.type}
                onChange={(e) => updatePiece(index, { type: e.target.value as ProductPiece['type'] })}
              >
                {PIECE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-label uppercase tracking-label text-ink-70">Fabric</span>
              <select
                className={selectClassName}
                value={piece.fabric}
                onChange={(e) => updatePiece(index, { fabric: e.target.value as Fabric })}
              >
                {Fabric.options.map((f) => (
                  <option key={f} value={f}>
                    {f.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-label uppercase tracking-label text-ink-70">Length (metres)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                className={selectClassName}
                value={piece.lengthMeters ?? ''}
                onChange={(e) => updatePiece(index, { lengthMeters: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <span className="text-label uppercase tracking-label text-ink-70">Work on this piece</span>
            <MultiCheckList options={WORK_OPTIONS} selected={piece.work} onChange={(work) => updatePiece(index, { work: work as ProductPiece['work'] })} />
          </div>

          <div className="flex flex-col gap-4">
            <span className="text-label uppercase tracking-label text-ink-70">Description</span>
            <input
              className={selectClassName}
              value={piece.descriptionEn}
              onChange={(e) => updatePiece(index, { descriptionEn: e.target.value })}
              placeholder="e.g. Digitally printed shirt front and back"
            />
          </div>

          <div>
            <Button type="button" variant="tertiary" onClick={() => removePiece(index)}>
              Remove this piece
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button type="button" variant="secondary" onClick={addPiece}>
          Add piece
        </Button>
      </div>
    </div>
  );
}
