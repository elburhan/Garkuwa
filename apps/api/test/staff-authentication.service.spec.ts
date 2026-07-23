import { UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import { StaffRole, UserStatus } from '../src/generated/prisma/enums.js';
import { StaffAuthenticationService } from '../src/modules/auth/staff-authentication.service.js';
import { STAFF_LOGIN_FAILURE_LIMIT } from '../src/modules/auth/auth.constants.js';
import type { PasswordHasherService } from '../src/modules/auth/password-hasher.service.js';

const now = new Date('2026-07-22T12:00:00.000Z');
const baseUser = {
  id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
  email: 'staff@example.test',
  passwordHash: '$argon2id$fake',
  displayName: 'Test Staff',
  role: StaffRole.MODERATOR as StaffRole,
  status: UserStatus.ACTIVE as UserStatus,
  lastLoginAt: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  passwordChangedAt: null,
  createdAt: now,
  updatedAt: now,
};

describe('StaffAuthenticationService', () => {
  const findUnique = jest.fn<() => Promise<typeof baseUser | null>>();
  const update = jest.fn<(arguments_: unknown) => Promise<typeof baseUser>>();
  const createSession =
    jest.fn<(arguments_: { data: Record<string, unknown> }) => Promise<{ id: string }>>();
  const transaction = jest.fn<(operations: Promise<unknown>[]) => Promise<unknown[]>>(
    async (operations) => Promise.all(operations),
  );
  const prisma = {
    user: { findUnique, update },
    staffSession: { create: createSession },
    $transaction: transaction,
  } as unknown as PrismaService;
  const verifyAgainstHashOrDummy =
    jest.fn<(hash: string | undefined, password: string) => Promise<boolean>>();
  const hasher = { verifyAgainstHashOrDummy } as unknown as PasswordHasherService;
  const service = new StaffAuthenticationService(prisma, hasher, () => now.getTime());

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue({ ...baseUser });
    verifyAgainstHashOrDummy.mockResolvedValue(true);
    update.mockResolvedValue({ ...baseUser });
    createSession.mockResolvedValue({ id: 'session-id' });
  });

  it('logs in active staff, resets failures, updates last login, and stores only a token hash', async () => {
    const result = await service.login({
      email: 'staff@example.test',
      password: 'Fake-development-password-42!',
    });

    expect(result.user).toEqual({
      id: baseUser.id,
      email: baseUser.email,
      name: baseUser.displayName,
      role: StaffRole.MODERATOR,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { lastLoginAt: now, failedLoginAttempts: 0, lockedUntil: null },
    });
    const sessionData = createSession.mock.calls[0]![0].data;
    expect(sessionData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionData.tokenHash).not.toBe(result.token);
    expect(sessionData.expiresAt).toEqual(new Date('2026-07-22T20:00:00.000Z'));
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('uses the generic failure for an unknown email', async () => {
    findUnique.mockResolvedValue(null);
    verifyAgainstHashOrDummy.mockResolvedValue(false);

    await expect(
      service.login({ email: 'unknown@example.test', password: 'Fake-password-value-42!' }),
    ).rejects.toEqual(new UnauthorizedException('Invalid email or password.'));
    expect(verifyAgainstHashOrDummy).toHaveBeenCalledWith(undefined, 'Fake-password-value-42!');
  });

  it('increments failed attempts for a wrong password', async () => {
    verifyAgainstHashOrDummy.mockResolvedValue(false);

    await expect(
      service.login({ email: baseUser.email, password: 'Wrong-password-value-42!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { failedLoginAttempts: 1, lockedUntil: null },
    });
  });

  it('temporarily locks the account at the configured failure threshold', async () => {
    findUnique.mockResolvedValue({
      ...baseUser,
      failedLoginAttempts: STAFF_LOGIN_FAILURE_LIMIT - 1,
    });
    verifyAgainstHashOrDummy.mockResolvedValue(false);

    await expect(
      service.login({ email: baseUser.email, password: 'Wrong-password-value-42!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: {
        failedLoginAttempts: STAFF_LOGIN_FAILURE_LIMIT,
        lockedUntil: new Date('2026-07-22T12:15:00.000Z'),
      },
    });
  });

  it.each([UserStatus.SUSPENDED])(
    'rejects %s staff with the same generic error',
    async (status) => {
      findUnique.mockResolvedValue({ ...baseUser, status });

      await expect(
        service.login({ email: baseUser.email, password: 'Fake-development-password-42!' }),
      ).rejects.toEqual(new UnauthorizedException('Invalid email or password.'));
      expect(createSession).not.toHaveBeenCalled();
    },
  );
});
