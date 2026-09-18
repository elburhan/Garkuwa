import { describe, expect, it, jest } from '@jest/globals';

import {
  assertFirstAdminEnvironment,
  createFirstAdmin,
  FirstAdminCliError,
  parseFirstAdminArguments,
  readFirstAdminInput,
  runFirstAdminCli,
  safeFirstAdminErrorMessage,
} from '../scripts/create-first-staff-admin.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { StaffRole, UserStatus } from '../src/generated/prisma/enums.js';
import { PasswordHasherService } from '../src/modules/auth/password-hasher.service.js';

const safePassword = 'Local-only-password-42!';
const safeArguments = [
  '--email',
  ' Local.Admin@Garkuwa.Test ',
  '--display-name',
  ' Local Administrator ',
] as const;

function validEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DEPLOYMENT_ENV: 'local',
    API_PORT: '4000',
    WEB_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://local:local@localhost:5432/garkuwa',
    CONTACT_DATA_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    STAFF_SESSION_COOKIE_SECURE: 'false',
    TRUST_PROXY: 'false',
    INCIDENT_STORAGE_DRIVER: 'filesystem',
    INCIDENT_STORAGE_FILESYSTEM_ROOT: '.var/test-incident-uploads',
    STAFF_BOOTSTRAP_PASSWORD: safePassword,
    ...overrides,
  };
}

function databaseDouble({
  count = 0,
  createError,
  connectError,
}: {
  count?: number;
  createError?: unknown;
  connectError?: unknown;
} = {}) {
  const createdData: unknown[] = [];
  const transaction = {
    user: {
      count: jest.fn(async () => count),
      create: jest.fn(async (input: { data: unknown }) => {
        if (createError) throw createError;
        createdData.push(input.data);
        const data = input.data as {
          email: string;
          displayName: string;
          role: typeof StaffRole.SUPER_ADMIN;
          status: typeof UserStatus.ACTIVE;
        };
        return {
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          status: data.status,
        };
      }),
    },
    staffSession: {
      create: jest.fn(),
    },
  };
  const connect = jest.fn(async () => {
    if (connectError) throw connectError;
  });
  const disconnect = jest.fn(async () => undefined);
  const database = {
    $connect: connect,
    $disconnect: disconnect,
    $transaction: jest.fn(async (operation: (client: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
    ),
  } as unknown as PrismaService;

  return { database, transaction, createdData, connect, disconnect };
}

function hasherDouble() {
  const hash = jest.fn(async () => '$argon2id$fake-development-hash');
  return { service: { hash } as unknown as PasswordHasherService, hash };
}

describe('local first staff administrator CLI', () => {
  it('accepts complete local and test configurations', () => {
    expect(() => assertFirstAdminEnvironment(validEnvironment())).not.toThrow();
    expect(() =>
      assertFirstAdminEnvironment(validEnvironment({ NODE_ENV: 'test', DEPLOYMENT_ENV: 'test' })),
    ).not.toThrow();
  });

  it('rejects production indicators before database access', async () => {
    for (const environment of [
      validEnvironment({ NODE_ENV: 'production' }),
      validEnvironment({ DEPLOYMENT_ENV: 'production' }),
    ]) {
      const { database, connect } = databaseDouble();
      await expect(
        runFirstAdminCli({
          arguments_: safeArguments,
          environment,
          prisma: database,
          passwordHasher: hasherDouble().service,
          writeOutput: () => undefined,
        }),
      ).rejects.toThrow('disabled');
      expect(connect).not.toHaveBeenCalled();
    }
  });

  it('rejects missing or inconsistent API configuration', () => {
    expect(() => assertFirstAdminEnvironment(validEnvironment({ API_PORT: undefined }))).toThrow(
      'Invalid API environment',
    );
    expect(() =>
      assertFirstAdminEnvironment(validEnvironment({ DEPLOYMENT_ENV: 'staging' })),
    ).toThrow('DEPLOYMENT_ENV must be explicitly set');
    expect(() =>
      assertFirstAdminEnvironment(validEnvironment({ DEPLOYMENT_ENV: undefined })),
    ).toThrow('DEPLOYMENT_ENV must be explicitly set');
  });

  it('normalizes valid input and rejects missing, invalid, unknown, duplicate, and password arguments', () => {
    expect(parseFirstAdminArguments(safeArguments)).toEqual({
      email: 'local.admin@garkuwa.test',
      displayName: 'Local Administrator',
    });

    const invalidArguments = [
      [],
      ['--email', 'invalid', '--display-name', 'Local Administrator'],
      ['--email', 'local.admin@garkuwa.test'],
      ['--email', 'local.admin@garkuwa.test', '--display-name', ' '],
      ['--email', 'local.admin@garkuwa.test', '--display-name', 'x'],
      ['--unknown', 'value'],
      ['--email', 'one@garkuwa.test', '--email', 'two@garkuwa.test'],
      ['--password', safePassword],
      [`--password=${safePassword}`],
    ];

    for (const arguments_ of invalidArguments) {
      expect(() => parseFirstAdminArguments(arguments_)).toThrow(FirstAdminCliError);
    }
  });

  it('requires a non-whitespace 12 to 128 character password from the environment', () => {
    for (const password of [undefined, 'short', '            ', 'x'.repeat(129)]) {
      expect(() =>
        readFirstAdminInput(
          safeArguments,
          validEnvironment({ STAFF_BOOTSTRAP_PASSWORD: password }),
        ),
      ).toThrow('STAFF_BOOTSTRAP_PASSWORD');
    }
    expect(readFirstAdminInput(safeArguments, validEnvironment()).password).toBe(safePassword);
  });

  it('creates exactly one active SUPER_ADMIN using the application Argon2id hasher path', async () => {
    const { database, transaction, createdData } = databaseDouble();
    const hasher = new PasswordHasherService();

    const result = await createFirstAdmin(database, hasher, {
      email: 'local.admin@garkuwa.test',
      displayName: 'Local Administrator',
      password: safePassword,
    });

    expect(result).toEqual({
      email: 'local.admin@garkuwa.test',
      displayName: 'Local Administrator',
      role: StaffRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    });
    expect(createdData).toHaveLength(1);
    const stored = createdData[0] as Record<string, unknown>;
    expect(stored.email).toBe('local.admin@garkuwa.test');
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toBe(safePassword);
    expect(stored.role).toBe(StaffRole.SUPER_ADMIN);
    expect(stored.status).toBe(UserStatus.ACTIVE);
    expect(stored).not.toHaveProperty('sessions');
    expect(JSON.stringify(stored)).not.toContain(safePassword);
    expect(transaction.staffSession.create).not.toHaveBeenCalled();
  });

  it('refuses an existing staff database without hashing, creating, or modifying a user', async () => {
    const { database, transaction } = databaseDouble({ count: 1 });
    const { service, hash } = hasherDouble();

    await expect(
      createFirstAdmin(database, service, {
        email: 'local.admin@garkuwa.test',
        displayName: 'Local Administrator',
        password: safePassword,
      }),
    ).rejects.toThrow('staff account already exists');
    expect(hash).not.toHaveBeenCalled();
    expect(transaction.user.create).not.toHaveBeenCalled();
  });

  it('handles duplicate-email and serializable race conflicts safely', async () => {
    for (const code of ['P2002', 'P2034']) {
      const { database } = databaseDouble({ createError: { code } });
      await expect(
        createFirstAdmin(database, hasherDouble().service, {
          email: 'local.admin@garkuwa.test',
          displayName: 'Local Administrator',
          password: safePassword,
        }),
      ).rejects.toThrow('another creation attempt won the race');
    }
  });

  it('prints only safe account metadata and disconnects on success', async () => {
    const { database, disconnect } = databaseDouble();
    const output: string[] = [];

    await runFirstAdminCli({
      arguments_: safeArguments,
      environment: validEnvironment(),
      prisma: database,
      passwordHasher: hasherDouble().service,
      writeOutput: (message) => output.push(message),
    });

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(output).toEqual([
      'Local first staff administrator created.',
      'Email: local.admin@garkuwa.test',
      'Display name: Local Administrator',
      'Role: SUPER_ADMIN',
      'Next step: open http://localhost:3000/admin/login',
    ]);
    const combined = output.join('\n');
    expect(combined).not.toContain(safePassword);
    expect(combined).not.toContain('argon2');
    expect(combined).not.toContain('session');
    expect(combined).not.toContain('postgresql');
  });

  it('disconnects when connection or creation fails', async () => {
    const connectionFailure = databaseDouble({ connectError: new Error('connection failed') });
    await expect(
      runFirstAdminCli({
        arguments_: safeArguments,
        environment: validEnvironment(),
        prisma: connectionFailure.database,
        passwordHasher: hasherDouble().service,
        writeOutput: () => undefined,
      }),
    ).rejects.toThrow('connection failed');
    expect(connectionFailure.disconnect).toHaveBeenCalledTimes(1);

    const creationFailure = databaseDouble({ count: 1 });
    await expect(
      runFirstAdminCli({
        arguments_: safeArguments,
        environment: validEnvironment(),
        prisma: creationFailure.database,
        passwordHasher: hasherDouble().service,
        writeOutput: () => undefined,
      }),
    ).rejects.toThrow('staff account already exists');
    expect(creationFailure.disconnect).toHaveBeenCalledTimes(1);
  });

  it('sanitizes unexpected failures without echoing database details', () => {
    expect(
      safeFirstAdminErrorMessage(
        new Error('connection refused for postgresql://private-user:private-password@database'),
      ),
    ).toBe(
      'First-admin creation failed safely. Verify the local environment and database, then try again.',
    );
    expect(safeFirstAdminErrorMessage(new FirstAdminCliError('Safe operator guidance.'))).toBe(
      'Safe operator guidance.',
    );
  });
});
