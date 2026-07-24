import { AttachmentStatus } from '../../../../generated/prisma/enums.js';

export const attachmentSecurityReviewDecisions = [
  AttachmentStatus.AVAILABLE,
  AttachmentStatus.REJECTED,
] as const;

export type AttachmentSecurityReviewDecision = (typeof attachmentSecurityReviewDecisions)[number];

export function isAllowedAttachmentSecurityReview(
  current: AttachmentStatus,
  decision: AttachmentStatus,
): decision is AttachmentSecurityReviewDecision {
  return (
    current === AttachmentStatus.QUARANTINED &&
    attachmentSecurityReviewDecisions.includes(decision as AttachmentSecurityReviewDecision)
  );
}
