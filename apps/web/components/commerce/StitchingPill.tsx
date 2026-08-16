import { humanize } from '@/lib/facets';

const STITCHING_LABELS: Record<string, string> = {
  unstitched: 'Unstitched',
  semi_stitched: 'Semi-stitched',
  pret: 'Ready to Wear',
  custom_stitchable: 'Custom Stitchable',
};

/**
 * plan.md §15.4 item 4: "Stitching type pill — the first thing a
 * Pakistani-fashion buyer looks for. `Unstitched · 3 Piece` in a bordered
 * pill." plan.md §13.2's banned-list correction applies here too — this is
 * a hairline-bordered rectangle, not a rounded-pill shape.
 */
export interface StitchingPillProps {
  stitchingType: string;
  pieceCount: 1 | 2 | 3 | null;
}

export function StitchingPill({ stitchingType, pieceCount }: StitchingPillProps) {
  const label = STITCHING_LABELS[stitchingType] ?? humanize(stitchingType);

  return (
    <span className="inline-flex w-fit items-center gap-8 border border-ink px-16 py-8 font-body text-label font-semibold tracking-label text-ink uppercase">
      {label}
      {pieceCount ? ` · ${pieceCount} Piece${pieceCount === 1 ? '' : 's'}` : ''}
    </span>
  );
}
