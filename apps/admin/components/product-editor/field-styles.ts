/** Shared class strings for the plain `<select>`/`<textarea>` controls used
 *  throughout the product editor — `@lulwah/ui` only exports `Button`/
 *  `Input` (see `docs/implemented-plan.md` §3), and every other admin
 *  screen (Orders, Order detail) already styles its native selects/
 *  textareas inline the same way rather than waiting on a design-system
 *  `Select` component, so the editor follows that established convention. */
export const selectClassName =
  'h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad';

export const textareaClassName = 'min-h-[80px] w-full border border-line bg-paper p-12 text-body-sm text-ink outline-none focus:border-zamurrad';

export const labelClassName = 'text-label font-semibold uppercase tracking-label text-ink-70';
