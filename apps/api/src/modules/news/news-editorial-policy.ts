import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { NewsArticleStatus, StaffRole } from '../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../auth/auth.types.js';
import type { NewsArticleDecisionDto } from './dto/news.dto.js';

export const newsViewerRoles = [
  StaffRole.SUPER_ADMIN,
  StaffRole.ADMIN,
  StaffRole.EDITOR,
  StaffRole.MODERATOR,
] as const;
export const newsCreatorRoles = [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.EDITOR] as const;

export const decisionTargetStatus: Record<NewsArticleDecisionDto['decision'], NewsArticleStatus> = {
  SUBMIT_FOR_REVIEW: NewsArticleStatus.IN_REVIEW,
  RETURN_TO_DRAFT: NewsArticleStatus.DRAFT,
  APPROVE_PUBLICATION: NewsArticleStatus.PUBLISHED,
  ARCHIVE: NewsArticleStatus.ARCHIVED,
};

const requiredFromStatus: Record<NewsArticleDecisionDto['decision'], NewsArticleStatus> = {
  SUBMIT_FOR_REVIEW: NewsArticleStatus.DRAFT,
  RETURN_TO_DRAFT: NewsArticleStatus.IN_REVIEW,
  APPROVE_PUBLICATION: NewsArticleStatus.IN_REVIEW,
  ARCHIVE: NewsArticleStatus.PUBLISHED,
};

export function assertCanEditDraft(authorId: string, actor: StaffPrincipal): void {
  if (
    actor.role !== StaffRole.SUPER_ADMIN &&
    actor.role !== StaffRole.ADMIN &&
    !(actor.role === StaffRole.EDITOR && actor.id === authorId)
  ) {
    throw new ForbiddenException('This staff account cannot edit this draft.');
  }
}

export function assertEditorialDecisionAllowed(
  currentStatus: NewsArticleStatus,
  authorId: string,
  decision: NewsArticleDecisionDto['decision'],
  actor: StaffPrincipal,
): NewsArticleStatus {
  if (currentStatus !== requiredFromStatus[decision]) {
    throw new BadRequestException('The requested editorial transition is not allowed.');
  }
  const administrators = actor.role === StaffRole.SUPER_ADMIN || actor.role === StaffRole.ADMIN;
  const allowed =
    (decision === 'SUBMIT_FOR_REVIEW' &&
      (administrators || (actor.role === StaffRole.EDITOR && actor.id === authorId))) ||
    (decision === 'RETURN_TO_DRAFT' && (administrators || actor.role === StaffRole.MODERATOR)) ||
    ((decision === 'APPROVE_PUBLICATION' || decision === 'ARCHIVE') && administrators);
  if (!allowed) throw new ForbiddenException('This staff account cannot perform this action.');
  return decisionTargetStatus[decision];
}
