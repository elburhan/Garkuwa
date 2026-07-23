import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import {
  STAFF_AUTH_CLOCK,
  STAFF_LOGIN_RATE_LIMIT,
  STAFF_LOGIN_RATE_WINDOW_MS,
  type StaffAuthClock,
} from './auth.constants.js';
import type { StaffAuthRequest } from './auth.types.js';

interface LoginRateEntry {
  count: number;
  windowStartedAt: number;
}

@Injectable()
export class StaffLoginRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, LoginRateEntry>();

  constructor(@Inject(STAFF_AUTH_CLOCK) private readonly clock: StaffAuthClock) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();
    const client = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const now = this.clock();
    const existing = this.entries.get(client);
    const entry =
      !existing || now - existing.windowStartedAt >= STAFF_LOGIN_RATE_WINDOW_MS
        ? { count: 0, windowStartedAt: now }
        : existing;

    if (entry.count >= STAFF_LOGIN_RATE_LIMIT) {
      throw new HttpException(
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count += 1;
    this.entries.set(client, entry);
    return true;
  }

  reset(): void {
    this.entries.clear();
  }
}
