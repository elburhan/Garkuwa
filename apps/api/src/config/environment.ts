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

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');
const optionalNonEmptyString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);
const originSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.origin === value && (url.protocol === 'http:' || url.protocol === 'https:');
}, 'must be an HTTP(S) origin without a path, query, or fragment');

const apiEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65_535),
    WEB_ORIGIN: originSchema,
    DATABASE_URL: z.url().startsWith('postgresql://'),
    CONTACT_DATA_ENCRYPTION_KEY: z.string().refine(isValidContactDataEncryptionKey, {
      message: 'must be canonical base64 that decodes to exactly 32 bytes',
    }),
    STAFF_SESSION_COOKIE_SECURE: booleanString,
    TRUST_PROXY: z.enum(['false', 'loopback']).default('false'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose']).default('log'),
    INCIDENT_STORAGE_DRIVER: z.enum(['filesystem', 's3']),
    INCIDENT_STORAGE_FILESYSTEM_ROOT: z.string().trim().min(1).optional(),
    ALLOW_PRODUCTION_FILESYSTEM_STORAGE: booleanString.default(false),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().trim().min(1).optional(),
    S3_BUCKET: z.string().trim().min(3).max(63).optional(),
    S3_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
    S3_FORCE_PATH_STYLE: booleanString.default(false),
    S3_SERVER_SIDE_ENCRYPTION: z.enum(['AES256', 'aws:kms']).default('AES256'),
    S3_KMS_KEY_ID: optionalNonEmptyString,
    DEPENDENCY_CHECK_TIMEOUT_MS: z.coerce.number().int().min(250).max(30_000).default(5_000),
    STORAGE_OPERATION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    SHUTDOWN_GRACE_PERIOD_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === 'production' && !environment.STAFF_SESSION_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['STAFF_SESSION_COOKIE_SECURE'],
        message: 'must be true when NODE_ENV is production',
      });
    }

    if (
      environment.NODE_ENV === 'production' &&
      new URL(environment.WEB_ORIGIN).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['WEB_ORIGIN'],
        message: 'must use HTTPS when NODE_ENV is production',
      });
    }

    if (environment.NODE_ENV === 'production') {
      const databaseUrl = new URL(environment.DATABASE_URL);
      if (
        ['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname) ||
        /replace|change.?me|example/i.test(databaseUrl.password)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['DATABASE_URL'],
          message: 'must not use a local host or placeholder password in production',
        });
      }

      if (/^A{43}=$/.test(environment.CONTACT_DATA_ENCRYPTION_KEY)) {
        context.addIssue({
          code: 'custom',
          path: ['CONTACT_DATA_ENCRYPTION_KEY'],
          message: 'must not use the all-zero validation key in production',
        });
      }
    }

    if (
      environment.NODE_ENV === 'production' &&
      environment.INCIDENT_STORAGE_DRIVER === 'filesystem' &&
      !environment.ALLOW_PRODUCTION_FILESYSTEM_STORAGE
    ) {
      context.addIssue({
        code: 'custom',
        path: ['INCIDENT_STORAGE_DRIVER'],
        message:
          'filesystem storage is disabled in production unless ALLOW_PRODUCTION_FILESYSTEM_STORAGE=true',
      });
    }

    if (
      environment.INCIDENT_STORAGE_DRIVER === 'filesystem' &&
      !environment.INCIDENT_STORAGE_FILESYSTEM_ROOT
    ) {
      context.addIssue({
        code: 'custom',
        path: ['INCIDENT_STORAGE_FILESYSTEM_ROOT'],
        message: 'is required when INCIDENT_STORAGE_DRIVER=filesystem',
      });
    }

    if (environment.INCIDENT_STORAGE_DRIVER === 's3') {
      const requiredS3Keys = [
        'S3_ENDPOINT',
        'S3_REGION',
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ] as const;

      for (const key of requiredS3Keys) {
        if (!environment[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required when INCIDENT_STORAGE_DRIVER=s3',
          });
        }
      }

      if (
        environment.NODE_ENV === 'production' &&
        environment.S3_ENDPOINT &&
        new URL(environment.S3_ENDPOINT).protocol !== 'https:'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['S3_ENDPOINT'],
          message: 'must use HTTPS when NODE_ENV is production',
        });
      }

      if (environment.S3_SERVER_SIDE_ENCRYPTION === 'aws:kms' && !environment.S3_KMS_KEY_ID) {
        context.addIssue({
          code: 'custom',
          path: ['S3_KMS_KEY_ID'],
          message: 'is required when S3_SERVER_SIDE_ENCRYPTION=aws:kms',
        });
      }

      if (
        environment.NODE_ENV === 'production' &&
        [environment.S3_ACCESS_KEY_ID, environment.S3_SECRET_ACCESS_KEY].some((value) =>
          /replace|change.?me|example/i.test(value ?? ''),
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['S3_ACCESS_KEY_ID'],
          message: 'production object-storage credentials must not be placeholder values',
        });
      }
    }
  });

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function parseApiEnvironment(input: NodeJS.ProcessEnv): ApiEnvironment {
  const result = apiEnvironmentSchema.safeParse(input);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API environment: ${problems}`);
  }

  return result.data;
}

export function getApiEnvironment(): ApiEnvironment {
  return parseApiEnvironment(process.env);
}
