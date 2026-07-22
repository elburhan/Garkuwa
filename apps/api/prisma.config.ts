import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const apiDirectory = fileURLToPath(new URL('.', import.meta.url));
const workspaceEnvironmentPath = fileURLToPath(new URL('../../.env', import.meta.url));

loadEnv({ path: workspaceEnvironmentPath, quiet: true });

export default defineConfig({
  schema: join(apiDirectory, 'prisma/schema.prisma'),
  migrations: {
    path: join(apiDirectory, 'prisma/migrations'),
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
