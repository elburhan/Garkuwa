import { existsSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import { isValidContactDataEncryptionKey } from '../common/security/contact-data-key.js';

function findWorkspaceEnvironmentPath(startDirectory: string): string | undefined {
  let directory = resolve(startDirectory);
  const filesystemRoot = parse(directory).root;

  while (directory !== filesystemRoot) {
    if (existsSync(join(directory, 'pnpm-workspace.yaml'))) {
      return join(directory, '.env');
    }

    directory = dirname(directory);
  }

  return undefined;
}

const workspaceEnvironmentPath = findWorkspaceEnvironmentPath(process.cwd());

if (workspaceEnvironmentPath) {
  loadEnv({ path: workspaceEnvironmentPath, quiet: true });
}

const apiEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65_535),
    WEB_ORIGIN: z.url(),
    DATABASE_URL: z.url().startsWith('postgresql://'),
    CONTACT_DATA_ENCRYPTION_KEY: z.string().refine(isValidContactDataEncryptionKey, {
      message: 'must be canonical base64 that decodes to exactly 32 bytes',
    }),
    STAFF_SESSION_COOKIE_SECURE: z.enum(['true', 'false']).transform((value) => value === 'true'),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === 'production' && !environment.STAFF_SESSION_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['STAFF_SESSION_COOKIE_SECURE'],
        message: 'must be true when NODE_ENV is production',
      });
    }
  });

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function getApiEnvironment(): ApiEnvironment {
  const result = apiEnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(`Invalid API environment: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}
