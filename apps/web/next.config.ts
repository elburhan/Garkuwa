import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

const workspaceEnvironmentPath = fileURLToPath(new URL('../../.env', import.meta.url));

loadEnv({ path: workspaceEnvironmentPath, quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: ['@garkuwa/i18n', '@garkuwa/contracts'],
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
      {
        key: 'Content-Security-Policy-Report-Only',
        value:
          "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
      },
    ];
    if (process.env.NODE_ENV === 'production') {
      headers.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }
    return [{ source: '/(.*)', headers }];
  },
};

export default nextConfig;
