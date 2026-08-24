import { slugify } from '@lulwah/utils';
import type { Fabric, PieceCount, ProductPiece, Size } from '@lulwah/contracts';

/**
 * Pure domain logic for the "Pakistani attributes" and "Variants" tabs of
 * the product editor (plan.md §11.1, §2) — kept framework-free and unit
 * tested the same way `lib/order-status.ts` is (plan.md §8.7's admin
 * pattern), per the task brief's instruction to extract and test any pure
 * logic rather than bury it inside a component.
 */

/** A suit's default piece breakdown by `pieceCount` (plan.md §2/§7.5: e.g.
 *  "a 3-piece unstitched lawn suit has a shirt, trouser and dupatta
 *  piece"). This is a starting point the Attributes tab pre-fills into the
 *  `pieces[]` editor — every field stays editable afterwards (fabric,
 *  length, work, description all differ per real product), and users can
 *  still add/remove rows freely. `null` (piece count not applicable — e.g.
 *  a single ready-to-wear garment with no piece breakdown) returns no
 *  default rows at all rather than guessing one. */
const DEFAULT_PIECE_TYPES_BY_COUNT: Record<Exclude<PieceCount, null>, ProductPiece['type'][]> = {
  1: ['shirt'],
  2: ['shirt', 'trouser'],
  3: ['shirt', 'trouser', 'dupatta'],
};

export function defaultPiecesForCount(pieceCount: PieceCount | null, fabric: Fabric): ProductPiece[] {
  if (pieceCount === null) return [];
  return DEFAULT_PIECE_TYPES_BY_COUNT[pieceCount].map((type) => ({
    type,
    fabric,
    lengthMeters: null,
    work: [],
    descriptionEn: '',
    descriptionAr: '',
  }));
}

// ---------------------------------------------------------------------------
// Variant matrix — size × colour generator
// ---------------------------------------------------------------------------

export interface VariantMatrixColor {
  /** The brand's own colour name, e.g. "Ferozi" — becomes `options.color`
   *  on the variant and feeds the SKU suffix. */
  name: string;
}

export interface VariantMatrixInput {
  /** Uppercased, hyphen-joined base — usually the product's article code. */
  skuBase: string;
  sizes: Size[];
  colors: VariantMatrixColor[];
  basePriceFils: number;
  weightGrams: number;
}

export interface VariantMatrixRow {
  size: Size | undefined;
  color: string | undefined;
  sku: string;
  priceFils: number;
  weightGrams: number;
}

/** Uppercase, alnum-only short code for a SKU suffix — "Off White" -> "OW",
 *  "Ferozi" -> "FE". Falls back to the first 2 slug characters so any
 *  colour name (including single-word ones) produces a stable, short,
 *  collision-resistant-enough suffix without needing a lookup table. */
function colorSkuCode(colorName: string): string {
  const words = slugify(colorName).split('-').filter(Boolean);
  if (words.length === 0) return 'XX';
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase() || 'XX';
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function skuSuffix(size: Size | undefined, color: VariantMatrixColor | undefined): string {
  const parts: string[] = [];
  if (size) parts.push(size);
  if (color) parts.push(colorSkuCode(color.name));
  return parts.join('-');
}

/**
 * Cartesian product of `sizes` × `colors` (either axis may be empty — a
 * product might vary only by size, only by colour, or, if both are empty,
 * this returns the single base row unchanged). This is what powers the
 * "generate variants" action on the Variants tab: the admin picks the
 * axes that apply to this product (plan.md §11.1: "size×colour matrix
 * generator where relevant" — not every product needs both), reviews/edits
 * the generated rows (price, SKU, weight are all per-row overridable
 * before submit), then each row becomes one real `POST .../variants` call.
 */
export function buildVariantMatrix(input: VariantMatrixInput): VariantMatrixRow[] {
  const base = input.skuBase.trim().toUpperCase();
  const sizes = input.sizes.length > 0 ? input.sizes : [undefined];
  const colors = input.colors.length > 0 ? input.colors : [undefined];

  const rows: VariantMatrixRow[] = [];
  for (const size of sizes) {
    for (const color of colors) {
      const suffix = skuSuffix(size, color);
      rows.push({
        size,
        color: color?.name,
        sku: suffix ? `${base}-${suffix}` : base,
        priceFils: input.basePriceFils,
        weightGrams: input.weightGrams,
      });
    }
  }
  return rows;
}
