import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      AUTH_RATE_LIMIT: '1000',
      STORAGE_DIR: join(tmpdir(), 'drawmyplace-api-test-storage'),
      MAX_UPLOAD_MB: '5',
    },
  },
});
