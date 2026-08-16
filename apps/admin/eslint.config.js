// @ts-check
import { baseConfig } from '@lulwah/config/eslint.config.js';

export default [...baseConfig, { ignores: ['.next/**'] }];
