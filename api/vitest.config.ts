import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each test file boots a real workerd instance with its own D1 database.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
    fileParallelism: false,
  },
});
