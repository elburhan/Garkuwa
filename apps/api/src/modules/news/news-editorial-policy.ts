import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { NewsArticleStatus } from '../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../auth/auth.types.js';
import { hasNewsroomCapability } from '../auth/newsroom-capabilities.js';
import type { NewsArticleDecisionDto } from './dto/news.dto.js';

export const decisionTargetStatus: Record<NewsArticleDecisionDto['decision'], NewsArticleStatus> = {
  SUBMIT_FOR_REVIEW: NewsArticleStatus.IN_REVIEW,
  REQUEST_CHANGES: NewsArticleStatus.CHANGES_REQUESTED,
  MARK_READY_TO_PUBLISH: NewsArticleStatus.READY_TO_PUBLISH,
  PUBLISH: NewsArticleStatus.PUBLISHED,
  UNPUBLISH: NewsArticleStatus.UNPUBLISHED,
  ARCHIVE: NewsArticleStatus.ARCHIVED,
};

const allowedFromStatus: Record<NewsArticleDecisionDto['decision'], readonly NewsArticleStatus[]> =
  {
    SUBMIT_FOR_REVIEW: [NewsArticleStatus.DRAFT, NewsArticleStatus.CHANGES_REQUESTED],
    REQUEST_CHANGES: [NewsArticleStatus.IN_REVIEW],
    MARK_READY_TO_PUBLISH: [NewsArticleStatus.IN_REVIEW, NewsArticleStatus.UNPUBLISHED],
    PUBLISH: [
      NewsArticleStatus.DRAFT,
      NewsArticleStatus.IN_REVIEW,
      NewsArticleStatus.READY_TO_PUBLISH,
    ],
    UNPUBLISH: [NewsArticleStatus.PUBLISHED],
    ARCHIVE: [NewsArticleStatus.PUBLISHED, NewsArticleStatus.UNPUBLISHED],
  };

export function assertCanEditDraft(
  authorId: string,
  status: NewsArticleStatus,
  actor: StaffPrincipal,
): void {
  if (status !== NewsArticleStatus.DRAFT && status !== NewsArticleStatus.CHANGES_REQUESTED) {
    throw new BadRequestException('Only editable newsroom drafts can be changed.');
  }
  if (
    !hasNewsroomCapability(actor.role, 'NEWS_EDIT_ANY') &&
    !(hasNewsroomCapability(actor.role, 'NEWS_EDIT_OWN') && actor.id === authorId)
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
  if (!allowedFromStatus[decision].includes(currentStatus)) {
    throw new BadRequestException('The requested editorial transition is not allowed.');
  }
  const allowed =
    (decision === 'SUBMIT_FOR_REVIEW' &&
      hasNewsroomCapability(actor.role, 'NEWS_SUBMIT_REVIEW') &&
      (actor.id === authorId || hasNewsroomCapability(actor.role, 'NEWS_EDIT_ANY'))) ||
    (decision === 'REQUEST_CHANGES' &&
      hasNewsroomCapability(actor.role, 'NEWS_REVIEW') &&
      hasNewsroomCapability(actor.role, 'NEWS_RETURN_FOR_CHANGES')) ||
    (decision === 'MARK_READY_TO_PUBLISH' &&
      hasNewsroomCapability(actor.role, 'NEWS_REVIEW') &&
      hasNewsroomCapability(actor.role, 'NEWS_MARK_READY')) ||
    (decision === 'PUBLISH' && hasNewsroomCapability(actor.role, 'NEWS_PUBLISH')) ||
    (decision === 'UNPUBLISH' && hasNewsroomCapability(actor.role, 'NEWS_UNPUBLISH')) ||
    (decision === 'ARCHIVE' && hasNewsroomCapability(actor.role, 'NEWS_ARCHIVE'));
  if (!allowed) throw new ForbiddenException('This staff account cannot perform this action.');
  return decisionTargetStatus[decision];
}
