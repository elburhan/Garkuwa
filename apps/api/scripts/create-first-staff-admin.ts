import process from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Prisma } from '../src/generated/prisma/client.js';
import { StaffRole, UserStatus } from '../src/generated/prisma/enums.js';
import { parseApiEnvironment } from '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { staffEmailSchema, staffPasswordSchema } from '../src/modules/auth/staff-auth.dto.js';
import { PasswordHasherService } from '../src/modules/auth/password-hasher.service.js';

const DISPLAY_NAME_MINIMUM_LENGTH = 2;
const DISPLAY_NAME_MAXIMUM_LENGTH = 160;
const allowedArguments = new Set(['--email', '--display-name']);

export interface FirstAdminInput {
  email: string;
  displayName: string;
  password: string;
}

export interface FirstAdminResult {
  email: string;
  displayName: string;
  role: typeof StaffRole.SUPER_ADMIN;
  status: typeof UserStatus.ACTIVE;
}

export class FirstAdminCliError extends Error {}

function argumentError(message: string): FirstAdminCliError {
  return new FirstAdminCliError(message);
}

export function safeFirstAdminErrorMessage(error: unknown): string {
  if (error instanceof FirstAdminCliError) {
    return error.message;
  }
  if (error instanceof Error && error.message.startsWith('Invalid API environment:')) {
    return error.message;
  }
  return 'First-admin creation failed safely. Verify the local environment and database, then try again.';
}

export function parseFirstAdminArguments(arguments_: readonly string[]): {
  email: string;
  displayName: string;
} {
  const values = new Map<string, string>();

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === '--password' || argument.startsWith('--password=')) {
      throw argumentError(
        'Passwords are not accepted as command-line arguments. Use STAFF_BOOTSTRAP_PASSWORD.',
      );
    }
    if (!allowedArguments.has(argument)) {
      throw argumentError(`Unknown argument: ${argument}`);
    }
    if (values.has(argument)) {
      throw argumentError(`Duplicate argument: ${argument}`);
    }

    const value = arguments_[index + 1];
    if (!value || value.startsWith('--')) {
      throw argumentError(`Missing value for ${argument}.`);
    }
    values.set(argument, value);
    index += 1;
  }

  const emailResult = staffEmailSchema.safeParse(values.get('--email'));
  if (!emailResult.success) {
    throw argumentError('Provide a valid staff email with --email.');
  }

  const displayName = values.get('--display-name')?.trim();
  if (
    !displayName ||
    displayName.length < DISPLAY_NAME_MINIMUM_LENGTH ||
    displayName.length > DISPLAY_NAME_MAXIMUM_LENGTH
  ) {
    throw argumentError(
      `Provide a display name containing ${DISPLAY_NAME_MINIMUM_LENGTH} to ${DISPLAY_NAME_MAXIMUM_LENGTH} characters with --display-name.`,
    );
  }

  return { email: emailResult.data, displayName };
}

export function assertFirstAdminEnvironment(environment: NodeJS.ProcessEnv): void {
  if (environment.NODE_ENV === 'production' || environment.DEPLOYMENT_ENV === 'production') {
    throw new FirstAdminCliError(
      'First-admin creation is disabled when NODE_ENV or DEPLOYMENT_ENV is production.',
    );
  }
  if (environment.DEPLOYMENT_ENV !== 'local' && environment.DEPLOYMENT_ENV !== 'test') {
    throw new FirstAdminCliError(
      'DEPLOYMENT_ENV must be explicitly set to local or test for first-admin creation.',
    );
  }

  parseApiEnvironment(environment);
}

export function readFirstAdminInput(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv,
): FirstAdminInput {
  const { email, displayName } = parseFirstAdminArguments(arguments_);
  const password = environment.STAFF_BOOTSTRAP_PASSWORD;
  const passwordResult = staffPasswordSchema.safeParse(password);
  if (!passwordResult.success || passwordResult.data.trim().length === 0) {
    throw new FirstAdminCliError(
      'STAFF_BOOTSTRAP_PASSWORD must contain between 12 and 128 characters.',
    );
  }
  return { email, displayName, password: passwordResult.data };
}

function isSafeFirstAccountConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

export async function createFirstAdmin(
  prisma: PrismaService,
  passwordHasher: PasswordHasherService,
  input: FirstAdminInput,
): Promise<FirstAdminResult> {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const staffCount = await transaction.user.count();
        if (staffCount !== 0) {
          throw new FirstAdminCliError(
            'First-admin creation refused because a staff account already exists. Subsequent staff provisioning requires a separately reviewed administrative workflow.',
          );
        }

        const passwordHash = await passwordHasher.hash(input.password);
        const now = new Date();
        const user = await transaction.user.create({
          data: {
            email: input.email,
            passwordHash,
            displayName: input.displayName,
            role: StaffRole.SUPER_ADMIN,
            status: UserStatus.ACTIVE,
            passwordChangedAt: now,
            createdAt: now,
            updatedAt: now,
          },
          select: {
            email: true,
            displayName: true,
            role: true,
            status: true,
          },
        });
        return {
          email: user.email,
          displayName: user.displayName,
          role: StaffRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isSafeFirstAccountConflict(error)) {
      throw new FirstAdminCliError(
        'First-admin creation was not completed because a staff account exists or another creation attempt won the race.',
      );
    }
    throw error;
  }
}

export async function runFirstAdminCli({
  arguments_,
  environment,
  prisma,
  passwordHasher,
  writeOutput,
}: {
  arguments_: readonly string[];
  environment: NodeJS.ProcessEnv;
  prisma: PrismaService;
  passwordHasher: PasswordHasherService;
  writeOutput: (message: string) => void;
}): Promise<void> {
  assertFirstAdminEnvironment(environment);
  const input = readFirstAdminInput(arguments_, environment);

  try {
    await prisma.$connect();
    const result = await createFirstAdmin(prisma, passwordHasher, input);
    writeOutput('Local first staff administrator created.');
    writeOutput(`Email: ${result.email}`);
    writeOutput(`Display name: ${result.displayName}`);
    writeOutput(`Role: ${result.role}`);
    writeOutput('Next step: open http://localhost:3000/admin/login');
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  assertFirstAdminEnvironment(process.env);
  const prisma = new PrismaService();
  await runFirstAdminCli({
    arguments_: process.argv.slice(2),
    environment: process.env,
    prisma,
    passwordHasher: new PasswordHasherService(),
    writeOutput: (message) => process.stdout.write(`${message}\n`),
  });
}

const isDirectInvocation =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectInvocation) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${safeFirstAdminErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
