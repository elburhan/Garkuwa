import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { StaffAuthRequest } from '../../auth/auth.types.js';

export const CONTACT_ACCESS_CLOCK = Symbol('CONTACT_ACCESS_CLOCK');
export type ContactAccessClock = () => number;
export const CONTACT_ACCESS_RATE_LIMIT = 10;
export const CONTACT_ACCESS_RATE_WINDOW_MS = 15 * 60 * 1000;

interface RateEntry {
  count: number;
  windowStartedAt: number;
}

@Injectable()
export class ContactAccessRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, RateEntry>();

  constructor(@Inject(CONTACT_ACCESS_CLOCK) private readonly clock: ContactAccessClock) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();
    const actorId = request.staffPrincipal?.id;
    if (!actorId) return true;

    const now = this.clock();
    const existing = this.entries.get(actorId);
    const entry =
      !existing || now - existing.windowStartedAt >= CONTACT_ACCESS_RATE_WINDOW_MS
        ? { count: 0, windowStartedAt: now }
        : existing;
    if (entry.count >= CONTACT_ACCESS_RATE_LIMIT) {
      throw new HttpException(
        'Too many contact-access attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    entry.count += 1;
    this.entries.set(actorId, entry);
    return true;
  }

  reset(): void {
    this.entries.clear();
  }
}
