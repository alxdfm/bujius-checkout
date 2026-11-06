import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `pnpm verify` runs the tests before the build, so the SDK resolves to its source.
export default defineConfig({
  resolve: {
    alias: {
      '@bujius/checkout-sdk': fileURLToPath(
        new URL('../../packages/sdk/src/index.ts', import.meta.url),
      ),
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
