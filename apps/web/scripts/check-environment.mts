import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';

loadEnv({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const { parseWebEnvironment } = await import('../src/lib/env.ts');
parseWebEnvironment(process.env);
console.log('Web environment validation passed.');
