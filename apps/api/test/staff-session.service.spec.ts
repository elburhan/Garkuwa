import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import { StaffRole, UserStatus } from '../src/generated/prisma/enums.js';
import { StaffSessionService } from '../src/modules/auth/staff-session.service.js';
import { hashStaffSessionToken } from '../src/modules/auth/session-token.js';

const token = 'fake-opaque-session-token';
const now = new Date('2026-07-22T12:00:00.000Z');

interface TestSession {
  id: string;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: StaffRole;
    status: UserStatus;
  };
}

describe('StaffSessionService', () => {
  const validSession: TestSession = {
    id: 'session-id',
    expiresAt: new Date('2026-07-22T20:00:00.000Z'),
    lastUsedAt: now,
    revokedAt: null,
    user: {
      id: 'user-id',
      email: 'staff@example.test',
      displayName: 'Test Staff',
      role: StaffRole.EDITOR,
      status: UserStatus.ACTIVE,
    },
  };
  const findUnique = jest.fn<() => Promise<typeof validSession | null>>();
  const updateMany = jest.fn<(arguments_: unknown) => Promise<{ count: number }>>();
  const prisma = {
    staffSession: { findUnique, updateMany },
  } as unknown as PrismaService;
  const service = new StaffSessionService(prisma, () => now.getTime());

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue(validSession);
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('accepts a valid session and exposes only a minimal principal', async () => {
    await expect(service.authenticate(token)).resolves.toEqual({
      id: 'user-id',
      email: 'staff@example.test',
      name: 'Test Staff',
      role: StaffRole.EDITOR,
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashStaffSessionToken(token) } }),
    );
  });

  it.each([
    ['expired', { expiresAt: now }],
    ['revoked', { revokedAt: now }],
    ['suspended user', { user: { ...validSession.user, status: UserStatus.SUSPENDED } }],
  ])('rejects an %s session', async (_label, changes) => {
    findUnique.mockResolvedValue({ ...validSession, ...changes });
    await expect(service.authenticate(token)).resolves.toBeNull();
  });

  it('revokes only the matching active session hash', async () => {
    await service.revoke(token);
    expect(updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashStaffSessionToken(token), revokedAt: null },
      data: { revokedAt: now },
    });
  });
});
