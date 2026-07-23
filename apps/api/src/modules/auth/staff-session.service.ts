import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { UserStatus } from '../../generated/prisma/enums.js';
import { STAFF_AUTH_CLOCK, type StaffAuthClock } from './auth.constants.js';
import type { StaffPrincipal } from './auth.types.js';
import { hashStaffSessionToken } from './session-token.js';

const LAST_USED_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class StaffSessionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(STAFF_AUTH_CLOCK) private readonly clock: StaffAuthClock,
  ) {}

  async authenticate(token: string): Promise<StaffPrincipal | null> {
    const now = new Date(this.clock());
    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash: hashStaffSessionToken(token) },
      select: {
        id: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        user: {
          select: { id: true, email: true, displayName: true, role: true, status: true },
        },
      },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      return null;
    }

    if (now.getTime() - session.lastUsedAt.getTime() >= LAST_USED_UPDATE_INTERVAL_MS) {
      await this.prisma.staffSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { lastUsedAt: now },
      });
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.displayName,
      role: session.user.role,
    };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.staffSession.updateMany({
      where: { tokenHash: hashStaffSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date(this.clock()) },
    });
  }
}
