import { z } from 'zod';

/**
 * Money — plan.md §8.1. Stored and computed as an integer number of fils
 * (1 AED = 100 fils), never a float. Every money field elsewhere is
 * suffixed `Fils` (plan.md §27.2), e.g. `grandTotalFils`.
 */
export const Fils = z.number().int().nonnegative();
export type Fils = z.infer<typeof Fils>;

/** A handful of ledger fields (refund deltas, balance due) are legitimately
 *  negative — kept distinct from `Fils` so a schema has to opt in. */
export const SignedFils = z.number().int();
export type SignedFils = z.infer<typeof SignedFils>;

/**
 * Nominal brand for call sites that want the type system to catch a raw
 * `number` (a quantity, a percentage) being passed where money is
 * expected. Construct with `toFils`, which validates as it brands — never
 * cast a client-supplied number directly (plan.md §8.1: "Never `parseFloat`
 * a price from the client. Prices always come from the database.").
 */
export type BrandedFils = number & { readonly __brand: 'Fils' };

export function toFils(value: number): BrandedFils {
  return Fils.parse(value) as BrandedFils;
}
