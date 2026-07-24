import { AttachmentStatus } from '../src/generated/prisma/enums.js';
import {
  attachmentSecurityReviewDecisions,
  isAllowedAttachmentSecurityReview,
} from '../src/modules/incidents/attachments/security-review/attachment-security-review-policy.js';
import { attachmentSecurityReviewSchema } from '../src/modules/incidents/attachments/security-review/dto/attachment-security-review.dto.js';

const expectedUpdatedAt = '2026-07-23T20:45:00.000Z';

describe('attachment security-review policy', () => {
  it.each([AttachmentStatus.AVAILABLE, AttachmentStatus.REJECTED])(
    'allows QUARANTINED to %s',
    (decision) => {
      expect(isAllowedAttachmentSecurityReview(AttachmentStatus.QUARANTINED, decision)).toBe(true);
    },
  );

  it.each(
    Object.values(AttachmentStatus).flatMap((current) =>
      Object.values(AttachmentStatus)
        .filter(
          (decision) =>
            current !== AttachmentStatus.QUARANTINED ||
            !attachmentSecurityReviewDecisions.includes(
              decision as (typeof attachmentSecurityReviewDecisions)[number],
            ),
        )
        .map((decision) => [current, decision] as const),
    ),
  )('rejects %s to %s', (current, decision) => {
    expect(isAllowedAttachmentSecurityReview(current, decision)).toBe(false);
  });

  it('requires a bounded reason, rejects unknown fields, and preserves internal formatting', () => {
    expect(
      attachmentSecurityReviewSchema.safeParse({
        decision: 'AVAILABLE',
        reason: 'too short',
        expectedUpdatedAt,
      }).success,
    ).toBe(false);
    expect(
      attachmentSecurityReviewSchema.safeParse({
        decision: 'AVAILABLE',
        reason: 'x'.repeat(1001),
        expectedUpdatedAt,
      }).success,
    ).toBe(false);
    const parsed = attachmentSecurityReviewSchema.parse({
      decision: 'REJECTED',
      reason: '  Reviewed externally.\n\nPotentially harmful content.  ',
      expectedUpdatedAt,
    });
    expect(parsed.reason).toBe('Reviewed externally.\n\nPotentially harmful content.');
    expect(
      attachmentSecurityReviewSchema.safeParse({
        ...parsed,
        unexpected: true,
      }).success,
    ).toBe(false);
  });
});
