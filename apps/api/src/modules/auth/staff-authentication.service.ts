import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { UserStatus } from '../../generated/prisma/enums.js';
import {
  STAFF_AUTH_CLOCK,
  STAFF_LOGIN_FAILURE_LIMIT,
  STAFF_LOGIN_LOCK_DURATION_MS,
  STAFF_SESSION_DURATION_MS,
  type StaffAuthClock,
} from './auth.constants.js';
import type { StaffLoginDto } from './staff-auth.dto.js';
import type { StaffPrincipal } from './auth.types.js';
import { PasswordHasherService } from './password-hasher.service.js';
import { generateStaffSessionToken, hashStaffSessionToken } from './session-token.js';

export interface StaffLoginResult {
  token: string;
  user: StaffPrincipal;
}

@Injectable()
export class StaffAuthenticationService {
  private readonly logger = new Logger(StaffAuthenticationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordHasherService) private readonly passwordHasher: PasswordHasherService,
    @Inject(STAFF_AUTH_CLOCK) private readonly clock: StaffAuthClock,
  ) {}

  async login(input: StaffLoginDto): Promise<StaffLoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const passwordIsValid = await this.passwordHasher.verifyAgainstHashOrDummy(
      user?.passwordHash,
      input.password,
    );
    const now = new Date(this.clock());
    const isLocked = Boolean(user?.lockedUntil && user.lockedUntil > now);

    if (!user || user.status !== UserStatus.ACTIVE || isLocked || !passwordIsValid) {
      if (user && user.status === UserStatus.ACTIVE && !isLocked && !passwordIsValid) {
        const failedLoginAttempts = user.failedLoginAttempts + 1;
        const lockedUntil =
          failedLoginAttempts >= STAFF_LOGIN_FAILURE_LIMIT
            ? new Date(now.getTime() + STAFF_LOGIN_LOCK_DURATION_MS)
            : null;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts, lockedUntil },
        });
        if (lockedUntil) this.logger.warn('Staff login temporarily locked after repeated failures');
      }
      this.logger.warn('Staff login rejected');
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = generateStaffSessionToken();
    const expiresAt = new Date(now.getTime() + STAFF_SESSION_DURATION_MS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now, failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.staffSession.create({
        data: {
          userId: user.id,
          tokenHash: hashStaffSessionToken(token),
          createdAt: now,
          lastUsedAt: now,
          expiresAt,
        },
      }),
    ]);

    this.logger.log(`Staff login succeeded for user ${user.id}`);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.displayName, role: user.role },
    };
  }
}
