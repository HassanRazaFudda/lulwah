// @ts-check
import { baseConfig } from '@lulwah/config/eslint.config.js';

// Module boundary enforcement — plan.md §5.3. `identity`, `catalog` and
// `inventory` exist so far; the remaining module names from the §5.3 table
// get added to this list as they land so the rule keeps policing new
// cross-module imports from day one instead of being retrofitted later.
//
// Deliberately NOT using @lulwah/config's `createModuleBoundaryZones`
// helper here: its `except` glob is resolved relative to the `from`
// glob's own directory in a way that lands one directory short of where
// each module's files actually live, so it ends up forbidding a module
// from importing its OWN model file too — every intra-module import
// (identity.repository.ts importing identity.model.ts, which is exactly
// the layering plan.md §5.4 requires) got flagged. Rather than patch a
// package other workstreams also depend on, this builds each zone's
// `from` as an explicit list of every OTHER module's model glob instead
// — no `except`, so no ambiguity about what it's relative to. With only
// one module today that list is empty (nothing to forbid yet); it fills
// in correctly the moment a second module name is added to MODULES.
const MODULES = ['identity', 'catalog', 'inventory', 'cart', 'pricing', 'audit'];

const moduleBoundaryZones = MODULES.map((moduleName) => ({
  target: `./src/modules/${moduleName}/**/*`,
  from: MODULES.filter((other) => other !== moduleName).map((other) => `./src/modules/${other}/*.model.ts`),
  message:
    'No cross-module Mongoose model imports (plan.md §5.3). Go through the ' +
    "other module's exported service interface or a domain event instead.",
}))
  // A zone with no "other modules" to forbid (true today, with only one
  // module) has an empty `from` — some resolvers treat that as "matches
  // everything" instead of "matches nothing", so drop it rather than risk
  // the opposite of the intended rule.
  .filter((zone) => zone.from.length > 0);

export default [
  ...baseConfig,
  {
    settings: { 'import-x/resolver': { typescript: true } },
    // `no-restricted-paths`'s own schema rejects an empty `zones` array
    // outright (it's not a no-op, it's a config error) — so with a single
    // module and nothing to restrict against yet, the rule is left
    // unregistered rather than passed a `[]` it can't validate. It comes
    // back the moment `MODULES` has two or more entries.
    rules: moduleBoundaryZones.length > 0 ? { 'import-x/no-restricted-paths': ['error', { zones: moduleBoundaryZones }] } : {},
  },
  {
    // Route files and Mongoose models are exempt from the file line-count
    // limit (plan.md §27.3).
    files: ['**/*.routes.ts', '**/*.model.ts'],
    rules: { 'max-lines': 'off' },
  },
  {
    // Integration tests legitimately assert on another module's persisted
    // state directly (e.g. "adjusting inventory stock updates the parent
    // Product's totalStock" — `inventory.integration.test.ts` reads
    // `ProductModel` to prove the cross-module side effect actually
    // happened, and `catalog.integration.test.ts`/
    // `inventory.integration.test.ts` both log a test user in via
    // `identity.model.ts`'s `UserModel`, same shortcut
    // `auth.integration.test.ts` already uses). The module boundary rule
    // (plan.md §5.3) exists to keep *production* code talking through
    // service interfaces/events, not to stop a test from checking the
    // database it just exercised over HTTP.
    files: ['**/__tests__/**/*.ts'],
    rules: { 'import-x/no-restricted-paths': 'off' },
  },
];
