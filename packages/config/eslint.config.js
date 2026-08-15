// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import-x';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Shared ESLint flat config — plan.md §27.1.
 *
 * `any` is banned as a hard error everywhere; use `unknown` plus a
 * narrowing guard. TS `enum` is banned too — `as const` objects/union
 * types instead (Zod's `z.enum` is fine, it is not the TS `enum` keyword).
 *
 * Usage from a package or app's own `eslint.config.js`:
 *
 *   import { baseConfig } from '@lulwah/config/eslint.config.js';
 *   export default [...baseConfig, ...myOverrides];
 */
export const baseConfig = tseslint.config(
  { ignores: ['dist/**', '.next/**', 'node_modules/**', '.turbo/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.es2023 },
    },
    plugins: { 'import-x': importPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'No TS `enum` (plan.md §27.1) — use an `as const` object + union type, or z.enum.',
        },
      ],
    },
  },
);

/**
 * Module-boundary rule scaffold — plan.md §5.3.
 *
 * Inside `apps/api/src/modules/*`, a module may only reach another module
 * through its exported service interface or a published domain event —
 * never a direct cross-module Mongoose model import. This builds the
 * `import-x/no-restricted-paths` zone list that enforces it (we use
 * `eslint-plugin-import-x`, the actively-maintained fork of
 * `eslint-plugin-import`, because the original does not yet declare
 * support for ESLint 10 — see plan.md §4.1's TypeScript-6.0 rationale for
 * the same class of ecosystem-lag problem). Nothing here activates the
 * rule on its own, because `packages/*` has no `modules/` tree to police
 * yet. `apps/api` plugs in its real module names once
 * `apps/api/src/modules/*` exists:
 *
 *   import { baseConfig, createModuleBoundaryZones } from '@lulwah/config/eslint.config.js';
 *
 *   const MODULES = [
 *     'identity', 'catalog', 'inventory', 'pricing', 'cart', 'checkout',
 *     'order', 'payment', 'shipping', 'stitching', 'content', 'engagement',
 *     'analytics',
 *   ];
 *
 *   export default [
 *     ...baseConfig,
 *     {
 *       settings: { 'import-x/resolver': { typescript: true } },
 *       rules: {
 *         'import-x/no-restricted-paths': ['error', { zones: createModuleBoundaryZones(MODULES) }],
 *       },
 *     },
 *   ];
 *
 * @param {string[]} moduleNames
 */
export function createModuleBoundaryZones(moduleNames) {
  return moduleNames.map((moduleName) => ({
    target: `./src/modules/${moduleName}/**/*`,
    from: './src/modules/*/*.model.ts',
    except: [`../${moduleName}/*.model.ts`],
    message:
      'No cross-module Mongoose model imports (plan.md §5.3). Go through the ' +
      "other module's exported service interface or a domain event instead.",
  }));
}

export default baseConfig;
