import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { StaffAuthRequest } from '../auth/auth.types.js';

export const NEWS_MUTATION_CLOCK = Symbol('NEWS_MUTATION_CLOCK');
export const NEWS_MUTATION_LIMIT = 60;
export const NEWS_MUTATION_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class NewsMutationRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, { count: number; startedAt: number }>();

  constructor(@Inject(NEWS_MUTATION_CLOCK) private readonly clock: () => number) {}

  canActivate(context: ExecutionContext): boolean {
    const actorId = context.switchToHttp().getRequest<StaffAuthRequest>().staffPrincipal?.id;
    if (!actorId) return true;
    const now = this.clock();
    const existing = this.entries.get(actorId);
    const entry =
      !existing || now - existing.startedAt >= NEWS_MUTATION_WINDOW_MS
        ? { count: 0, startedAt: now }
        : existing;
    if (entry.count >= NEWS_MUTATION_LIMIT) {
      throw new HttpException(
        'Too many editorial changes. Please try again later.',
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
