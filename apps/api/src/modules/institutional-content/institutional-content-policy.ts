import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { InstitutionalPageWorkflowStatus, StaffRole } from '../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../auth/auth.types.js';
import type { InstitutionalPageDecisionDto } from './dto/institutional-content.dto.js';

export const institutionalPageViewerRoles = [
  StaffRole.SUPER_ADMIN,
  StaffRole.ADMIN,
  StaffRole.EDITOR,
  StaffRole.MODERATOR,
] as const;
export const institutionalPageEditorRoles = [
  StaffRole.SUPER_ADMIN,
  StaffRole.ADMIN,
  StaffRole.EDITOR,
] as const;

export function assertInstitutionalDecisionAllowed(
  current: InstitutionalPageWorkflowStatus,
  decision: InstitutionalPageDecisionDto['decision'],
  actor: StaffPrincipal,
): InstitutionalPageWorkflowStatus {
  const administrators = actor.role === StaffRole.SUPER_ADMIN || actor.role === StaffRole.ADMIN;
  const allowed =
    (decision === 'SUBMIT_FOR_REVIEW' &&
      current === InstitutionalPageWorkflowStatus.DRAFT &&
      (administrators || actor.role === StaffRole.EDITOR)) ||
    (decision === 'RETURN_TO_DRAFT' &&
      current === InstitutionalPageWorkflowStatus.IN_REVIEW &&
      (administrators || actor.role === StaffRole.MODERATOR)) ||
    (decision === 'PUBLISH' &&
      current === InstitutionalPageWorkflowStatus.IN_REVIEW &&
      administrators);
  if (!allowed) {
    const validState =
      (decision === 'SUBMIT_FOR_REVIEW' && current === InstitutionalPageWorkflowStatus.DRAFT) ||
      ((decision === 'RETURN_TO_DRAFT' || decision === 'PUBLISH') &&
        current === InstitutionalPageWorkflowStatus.IN_REVIEW);
    if (!validState) throw new BadRequestException('The requested content transition is invalid.');
    throw new ForbiddenException('This staff account cannot perform this content action.');
  }
  return decision === 'SUBMIT_FOR_REVIEW'
    ? InstitutionalPageWorkflowStatus.IN_REVIEW
    : decision === 'RETURN_TO_DRAFT'
      ? InstitutionalPageWorkflowStatus.DRAFT
      : InstitutionalPageWorkflowStatus.PUBLISHED;
}
