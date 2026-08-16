// @ts-check
import { baseConfig } from '@lulwah/config/eslint.config.js';

export default [
  ...baseConfig,
  { ignores: ['.next/**', 'next-env.d.ts'] },
  {
    rules: {
      // Route Handlers, layouts and pages export plain async functions per
      // Next.js App Router convention — not every file exports a component.
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];
