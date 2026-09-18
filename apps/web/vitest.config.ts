import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@garkuwa/contracts/newsroom': fileURLToPath(
        new URL('../../packages/contracts/src/newsroom.ts', import.meta.url),
      ),
      '@garkuwa/contracts/media': fileURLToPath(
        new URL('../../packages/contracts/src/media.ts', import.meta.url),
      ),
      '@garkuwa/contracts/live': fileURLToPath(
        new URL('../../packages/contracts/src/live.ts', import.meta.url),
      ),
      '@garkuwa/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url),
      ),
    },
  },
});
