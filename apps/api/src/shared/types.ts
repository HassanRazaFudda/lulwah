/**
 * Like TS's built-in `Partial<T>`, but explicitly allows `T[K] | undefined`
 * for present keys — matches what a Zod `.partial()` schema's inferred
 * type produces (every field becomes `field?: T | undefined`), which
 * `exactOptionalPropertyTypes` (plan.md §27.1) treats as a *different*
 * type from built-in `Partial<T>`'s `field?: T` (omittable, but never
 * literally `undefined` when present). Used by `*.repository.ts` "update"
 * input types that accept an already Zod-parsed admin DTO object directly,
 * so a spread like `{ ...input, computedField }` type-checks without
 * manually stripping `undefined` keys field-by-field first.
 */
export type PartialWithUndefined<T> = { [K in keyof T]?: T[K] | undefined };
