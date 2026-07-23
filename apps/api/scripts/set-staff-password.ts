import process from 'node:process';

import { PrismaService } from '../src/database/prisma.service.js';
import { PasswordHasherService } from '../src/modules/auth/password-hasher.service.js';

function readEmailArgument(arguments_: string[]): string | undefined {
  const index = arguments_.indexOf('--email');
  return index >= 0 ? arguments_[index + 1]?.trim().toLowerCase() : undefined;
}

async function main(): Promise<void> {
  const email = readEmailArgument(process.argv.slice(2));
  const password = process.env.STAFF_BOOTSTRAP_PASSWORD;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Provide an existing normalized staff email with --email.');
  }
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error('STAFF_BOOTSTRAP_PASSWORD must contain between 12 and 128 characters.');
  }

  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error('No existing staff user matches the supplied email.');

    const now = new Date();
    const passwordHash = await new PasswordHasherService().hash(password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
        sessions: {
          updateMany: { where: { revokedAt: null }, data: { revokedAt: now } },
        },
      },
    });
    process.stdout.write('Staff password updated and existing sessions revoked.\n');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Password update failed.'}\n`);
  process.exitCode = 1;
});
