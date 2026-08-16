import { defineConfig } from 'vitest/config';

/**
 * Plain Node environment — the only test in this workstream
 * (`lib/order-status.test.ts`) exercises a pure function, no DOM needed.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
