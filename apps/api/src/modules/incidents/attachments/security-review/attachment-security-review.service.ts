import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../../database/prisma.service.js';
import {
  AttachmentReviewSource,
  AttachmentStatus,
  StaffRole,
} from '../../../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../../../auth/auth.types.js';
import type { AttachmentSecurityReviewDto } from './dto/attachment-security-review.dto.js';
import { isAllowedAttachmentSecurityReview } from './attachment-security-review-policy.js';

export const ATTACHMENT_SECURITY_REVIEW_CLOCK = Symbol('ATTACHMENT_SECURITY_REVIEW_CLOCK');
export type AttachmentSecurityReviewClock = () => number;

function conflict(): ConflictException {
  return new ConflictException('The attachment changed and must be refreshed.');
}

function nextTimestamp(current: Date, clock: AttachmentSecurityReviewClock): Date {
  return new Date(Math.max(clock(), current.getTime() + 1));
}

@Injectable()
export class AttachmentSecurityReviewService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ATTACHMENT_SECURITY_REVIEW_CLOCK)
    private readonly clock: AttachmentSecurityReviewClock,
  ) {}

  async review(
    incidentId: string,
    attachmentId: string,
    input: AttachmentSecurityReviewDto,
    actor: StaffPrincipal,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const attachment = await transaction.incidentAttachment.findFirst({
        where: { id: attachmentId, incidentId },
        select: { id: true, incidentId: true, status: true, updatedAt: true },
      });
      if (!attachment) throw new NotFoundException('Attachment not found.');

      const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
      if (attachment.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
      if (!isAllowedAttachmentSecurityReview(attachment.status, input.decision)) {
        throw new BadRequestException(
          'Only quarantined attachments may receive a terminal security-review decision.',
        );
      }

      const reviewedAt = nextTimestamp(attachment.updatedAt, this.clock);
      const updated = await transaction.incidentAttachment.updateMany({
        where: {
          id: attachmentId,
          incidentId,
          status: AttachmentStatus.QUARANTINED,
          updatedAt: expectedUpdatedAt,
        },
        data:
          input.decision === AttachmentStatus.AVAILABLE
            ? {
                status: AttachmentStatus.AVAILABLE,
                availableAt: reviewedAt,
                rejectedAt: null,
                rejectionReason: null,
                updatedAt: reviewedAt,
              }
            : {
                status: AttachmentStatus.REJECTED,
                availableAt: null,
                rejectedAt: reviewedAt,
                rejectionReason: input.reason,
                updatedAt: reviewedAt,
              },
      });
      if (updated.count !== 1) throw conflict();

      const review = await transaction.incidentAttachmentSecurityReview.create({
        data: {
          attachmentId,
          incidentId,
          reviewedByUserId: actor.id,
          decision: input.decision,
          reason: input.reason,
          reviewSource: AttachmentReviewSource.MANUAL,
          createdAt: reviewedAt,
        },
        select: {
          decision: true,
          reason: true,
          reviewSource: true,
          createdAt: true,
          reviewedBy: { select: { id: true, displayName: true } },
        },
      });

      return {
        attachment: {
          id: attachment.id,
          status: input.decision,
          availableAt:
            input.decision === AttachmentStatus.AVAILABLE ? reviewedAt.toISOString() : null,
          rejectedAt:
            input.decision === AttachmentStatus.REJECTED ? reviewedAt.toISOString() : null,
          updatedAt: reviewedAt.toISOString(),
        },
        review: {
          decision: review.decision,
          reason: review.reason,
          reviewedAt: review.createdAt.toISOString(),
          reviewedBy: review.reviewedBy,
          reviewSource: review.reviewSource,
        },
      };
    });
  }

  async history(incidentId: string, attachmentId: string, actor: StaffPrincipal) {
    const attachment = await this.prisma.incidentAttachment.findFirst({
      where: { id: attachmentId, incidentId },
      select: { id: true },
    });
    if (!attachment) throw new NotFoundException('Attachment not found.');

    const mayReadReason = actor.role === StaffRole.SUPER_ADMIN || actor.role === StaffRole.ADMIN;
    const rows = await this.prisma.incidentAttachmentSecurityReview.findMany({
      where: { attachmentId, incidentId },
      select: {
        id: true,
        decision: true,
        reason: true,
        reviewSource: true,
        scannerEngine: true,
        scannerVersion: true,
        scannerSignature: true,
        createdAt: true,
        reviewedBy: { select: { id: true, displayName: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        decision: row.decision,
        reviewSource: row.reviewSource,
        reason: mayReadReason ? row.reason : null,
        reviewedAt: row.createdAt.toISOString(),
        reviewedBy: row.reviewedBy,
        scanner:
          row.reviewSource === AttachmentReviewSource.SCANNER
            ? {
                engine: row.scannerEngine,
                engineVersion: row.scannerVersion,
                signature: row.scannerSignature,
              }
            : null,
      })),
    };
  }
}
