import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import {
  AttachmentReviewSource,
  AttachmentStatus,
  StaffRole,
} from '../src/generated/prisma/enums.js';
import { AttachmentSecurityReviewService } from '../src/modules/incidents/attachments/security-review/attachment-security-review.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const attachmentId = 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0';
const actorId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const updatedAt = new Date('2026-07-23T20:45:00.000Z');
const reviewedAt = new Date('2026-07-23T20:46:00.000Z');
const reason = 'Reviewed in the approved isolated environment.';
const actor = {
  id: actorId,
  email: 'admin@example.test',
  name: 'Admin',
  role: StaffRole.ADMIN,
};

describe('AttachmentSecurityReviewService', () => {
  const findFirst = jest.fn<(input: unknown) => Promise<unknown>>();
  const updateMany = jest.fn<(input: unknown) => Promise<{ count: number }>>();
  const createReview = jest.fn<(input: unknown) => Promise<unknown>>();
  const findMany = jest.fn<(input: unknown) => Promise<unknown[]>>();
  const transaction = {
    incidentAttachment: { findFirst, updateMany },
    incidentAttachmentSecurityReview: { create: createReview, findMany },
  };
  const prisma = {
    $transaction: jest.fn(async (operation: (client: typeof transaction) => unknown) =>
      operation(transaction),
    ),
    incidentAttachment: { findFirst },
    incidentAttachmentSecurityReview: { findMany },
  } as unknown as PrismaService;
  const service = new AttachmentSecurityReviewService(prisma, () => reviewedAt.getTime());

  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue({
      id: attachmentId,
      incidentId,
      status: AttachmentStatus.QUARANTINED,
      updatedAt,
    });
    updateMany.mockResolvedValue({ count: 1 });
    createReview.mockResolvedValue({
      decision: AttachmentStatus.AVAILABLE,
      reason,
      reviewSource: AttachmentReviewSource.MANUAL,
      createdAt: reviewedAt,
      reviewedBy: { id: actorId, displayName: 'Admin' },
    });
    findMany.mockResolvedValue([]);
  });

  it('atomically approves from QUARANTINED with a conditional update and minimal audit', async () => {
    const response = await service.review(
      incidentId,
      attachmentId,
      {
        decision: AttachmentStatus.AVAILABLE,
        reason,
        expectedUpdatedAt: updatedAt.toISOString(),
      },
      actor,
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: attachmentId,
        incidentId,
        status: AttachmentStatus.QUARANTINED,
        updatedAt,
      },
      data: {
        status: AttachmentStatus.AVAILABLE,
        availableAt: reviewedAt,
        rejectedAt: null,
        rejectionReason: null,
        updatedAt: reviewedAt,
      },
    });
    expect(createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          attachmentId,
          incidentId,
          reviewedByUserId: actorId,
          decision: AttachmentStatus.AVAILABLE,
          reason,
          reviewSource: AttachmentReviewSource.MANUAL,
          createdAt: reviewedAt,
        },
      }),
    );
    expect(response).toMatchObject({
      attachment: { status: AttachmentStatus.AVAILABLE, rejectedAt: null },
      review: { reviewSource: AttachmentReviewSource.MANUAL },
    });
    expect(JSON.stringify(createReview.mock.calls[0]![0])).not.toMatch(
      /objectKey|sha256|filename|contact|session/i,
    );
  });

  it('rejects with terminal timestamps and the bounded reason', async () => {
    createReview.mockResolvedValueOnce({
      decision: AttachmentStatus.REJECTED,
      reason,
      reviewSource: AttachmentReviewSource.MANUAL,
      createdAt: reviewedAt,
      reviewedBy: { id: actorId, displayName: 'Admin' },
    });
    await service.review(
      incidentId,
      attachmentId,
      {
        decision: AttachmentStatus.REJECTED,
        reason,
        expectedUpdatedAt: updatedAt.toISOString(),
      },
      actor,
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: AttachmentStatus.REJECTED,
          availableAt: null,
          rejectedAt: reviewedAt,
          rejectionReason: reason,
          updatedAt: reviewedAt,
        },
      }),
    );
  });

  it('returns safe not-found, conflict, and invalid-transition errors before mutation', async () => {
    findFirst.mockResolvedValueOnce(null);
    await expect(
      service.review(
        incidentId,
        attachmentId,
        {
          decision: AttachmentStatus.AVAILABLE,
          reason,
          expectedUpdatedAt: updatedAt.toISOString(),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    findFirst.mockResolvedValueOnce({
      id: attachmentId,
      status: AttachmentStatus.QUARANTINED,
      updatedAt,
    });
    await expect(
      service.review(
        incidentId,
        attachmentId,
        {
          decision: AttachmentStatus.AVAILABLE,
          reason,
          expectedUpdatedAt: '2026-07-23T20:00:00.000Z',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    findFirst.mockResolvedValueOnce({
      id: attachmentId,
      status: AttachmentStatus.AVAILABLE,
      updatedAt,
    });
    await expect(
      service.review(
        incidentId,
        attachmentId,
        {
          decision: AttachmentStatus.REJECTED,
          reason,
          expectedUpdatedAt: updatedAt.toISOString(),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('treats a lost conditional update as a concurrency conflict', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.review(
        incidentId,
        attachmentId,
        {
          decision: AttachmentStatus.AVAILABLE,
          reason,
          expectedUpdatedAt: updatedAt.toISOString(),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createReview).not.toHaveBeenCalled();
  });

  it('returns deterministic history with reasons restricted for lower roles', async () => {
    findFirst.mockResolvedValue({ id: attachmentId });
    findMany.mockResolvedValue([
      {
        id: 'review-id',
        decision: AttachmentStatus.AVAILABLE,
        reason,
        reviewSource: AttachmentReviewSource.MANUAL,
        scannerEngine: null,
        scannerVersion: null,
        scannerSignature: null,
        createdAt: reviewedAt,
        reviewedBy: { id: actorId, displayName: 'Admin' },
      },
    ]);
    const adminHistory = await service.history(incidentId, attachmentId, actor);
    const analystHistory = await service.history(incidentId, attachmentId, {
      ...actor,
      role: StaffRole.ANALYST,
    });
    expect(adminHistory.items[0]?.reason).toBe(reason);
    expect(analystHistory.items[0]?.reason).toBeNull();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  });
});
