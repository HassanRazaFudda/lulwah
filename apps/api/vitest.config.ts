import { defineConfig } from 'vitest/config';

/**
 * mongodb-memory-server downloads/boots a real `mongod` the first time it
 * runs, and integration tests spin up an Express app on top of it — both
 * slower than typical unit tests, hence the generous timeouts. No global
 * setup file: each integration test file owns its own in-memory Mongo
 * instance so test files stay independent and parallel-safe.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    // shared/env.ts parses process.env eagerly at import time (crashes
    // boot on anything missing, by design — plan.md §25.3). These are
    // harmless placeholders so importing app.ts in a test doesn't need a
    // real .env file; MONGODB_URI is never actually dialed through env —
    // tests connect explicitly to mongodb-memory-server's own URI instead
    // (see mongo.ts's `connect(uri)` parameter), and REDIS_URL is never
    // dialed at all since tests inject `InMemoryRateLimitStore`.
    env: {
      NODE_ENV: 'test',
      PORT: '4001',
      API_URL: 'http://localhost:4001',
      WEB_URL: 'http://localhost:3000',
      ADMIN_URL: 'http://localhost:3001',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/lulwah-test',
      REDIS_URL: 'redis://127.0.0.1:6379/1',
      JWT_ACCESS_SECRET: 'test-only-access-secret-do-not-use-in-prod',
      JWT_REFRESH_SECRET: 'test-only-refresh-secret-do-not-use-in-prod',
      COOKIE_SECURE: 'false',
      LOG_LEVEL: 'silent',
    },
  },
});
