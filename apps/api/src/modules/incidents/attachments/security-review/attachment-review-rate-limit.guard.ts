import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { StaffAuthRequest } from '../../../auth/auth.types.js';

export const ATTACHMENT_REVIEW_CLOCK = Symbol('ATTACHMENT_REVIEW_CLOCK');
export type AttachmentReviewClock = () => number;
export const ATTACHMENT_REVIEW_LIMIT = 20;
export const ATTACHMENT_REVIEW_WINDOW_MS = 15 * 60 * 1000;

interface RateEntry {
  count: number;
  windowStartedAt: number;
}

@Injectable()
export class AttachmentReviewRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, RateEntry>();

  constructor(@Inject(ATTACHMENT_REVIEW_CLOCK) private readonly clock: AttachmentReviewClock) {}

  canActivate(context: ExecutionContext): boolean {
    const actorId = context.switchToHttp().getRequest<StaffAuthRequest>().staffPrincipal?.id;
    if (!actorId) return true;

    const now = this.clock();
    const existing = this.entries.get(actorId);
    const entry =
      !existing || now - existing.windowStartedAt >= ATTACHMENT_REVIEW_WINDOW_MS
        ? { count: 0, windowStartedAt: now }
        : existing;
    if (entry.count >= ATTACHMENT_REVIEW_LIMIT) {
      throw new HttpException(
        'Too many attachment review attempts. Please try again later.',
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
