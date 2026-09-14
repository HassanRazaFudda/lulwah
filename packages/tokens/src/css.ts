import { colorAlphas, colors } from './colors.js';

/**
 * Maps each `colors`/`colorAlphas` key to its CSS custom-property name.
 * Written out explicitly (rather than derived by a camelCase→kebab-case
 * regex) so that adding a token to `colors.ts` without adding it here is a
 * compile error — `Record<keyof typeof colors, string>` forces the two
 * objects to stay in sync.
 */
const colorCssVarNames: Record<keyof typeof colors, string> = {
  ink: '--ink',
  paper: '--paper',
  pearl: '--pearl',
  nacre: '--nacre',
  zamurrad: '--zamurrad',
  zamurradDeep: '--zamurrad-deep',
  goldDark: '--gold-dark',
  gold: '--gold',
  goldLight: '--gold-light',
  garnet: '--garnet',
  plum: '--plum',
  plumDark: '--plum-dark',
  mukaish: '--mukaish',
  success: '--success',
  warning: '--warning',
  danger: '--danger',
};

const colorAlphaCssVarNames: Record<keyof typeof colorAlphas, string> = {
  ink70: '--ink-70',
  ink20: '--ink-20',
  line: '--line',
};

/**
 * Emits the `:root { --ink: ...; --zamurrad: ...; }` CSS custom-properties
 * block — plan.md §13.3. Apps import this to generate `tokens.css` at
 * build time rather than hand-copying hex values into a stylesheet.
 */
export function buildColorCss(): string {
  const colorLines = Object.entries(colors).map(([key, hex]) => {
    const varName = colorCssVarNames[key as keyof typeof colors];
    return `  ${varName}: ${hex};`;
  });
  const alphaLines = Object.entries(colorAlphas).map(([key, value]) => {
    const varName = colorAlphaCssVarNames[key as keyof typeof colorAlphas];
    return `  ${varName}: ${value};`;
  });
  return [':root {', ...colorLines, ...alphaLines, '}'].join('\n');
}
