import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { StaffAuthRequest } from '../auth/auth.types.js';

export const INSTITUTIONAL_CONTENT_MUTATION_CLOCK = Symbol('INSTITUTIONAL_CONTENT_MUTATION_CLOCK');
export const INSTITUTIONAL_CONTENT_MUTATION_LIMIT = 60;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class InstitutionalContentRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, { count: number; startedAt: number }>();

  constructor(@Inject(INSTITUTIONAL_CONTENT_MUTATION_CLOCK) private readonly clock: () => number) {}

  canActivate(context: ExecutionContext): boolean {
    const actorId = context.switchToHttp().getRequest<StaffAuthRequest>().staffPrincipal?.id;
    if (!actorId) return true;
    const now = this.clock();
    const existing = this.entries.get(actorId);
    const entry =
      !existing || now - existing.startedAt >= WINDOW_MS ? { count: 0, startedAt: now } : existing;
    if (entry.count >= INSTITUTIONAL_CONTENT_MUTATION_LIMIT) {
      throw new HttpException(
        'Too many content changes. Please try again later.',
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
