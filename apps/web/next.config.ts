import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

const workspaceEnvironmentPath = fileURLToPath(new URL('../../.env', import.meta.url));

loadEnv({ path: workspaceEnvironmentPath, quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: ['@garkuwa/i18n'],
};

export default nextConfig;
