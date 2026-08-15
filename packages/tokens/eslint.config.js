// Relative import, not the @lulwah/config package specifier: config's
// tailwind-preset.ts imports @lulwah/tokens, so a workspace dependency in
// the other direction (tokens -> config) would make pnpm/Turborepo see a
// cycle. Same shared config either way.
import { baseConfig } from '../config/eslint.config.js';

export default [...baseConfig];
