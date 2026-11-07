import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The packages come from npm, so the tests exercise what the store deploys.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
