import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { StaffAuthRequest } from '../../auth/auth.types.js';

export const STAFF_NOTE_CLOCK = Symbol('STAFF_NOTE_CLOCK');
export type StaffNoteClock = () => number;
export const STAFF_NOTE_MUTATION_LIMIT = 30;
export const STAFF_NOTE_MUTATION_WINDOW_MS = 15 * 60 * 1000;

interface RateEntry {
  count: number;
  windowStartedAt: number;
}

@Injectable()
export class StaffNoteRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, RateEntry>();

  constructor(@Inject(STAFF_NOTE_CLOCK) private readonly clock: StaffNoteClock) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();
    const actorId = request.staffPrincipal?.id;
    if (!actorId) return true;
    const now = this.clock();
    const existing = this.entries.get(actorId);
    const entry =
      !existing || now - existing.windowStartedAt >= STAFF_NOTE_MUTATION_WINDOW_MS
        ? { count: 0, windowStartedAt: now }
        : existing;
    if (entry.count >= STAFF_NOTE_MUTATION_LIMIT) {
      throw new HttpException(
        'Too many note changes. Please try again later.',
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
