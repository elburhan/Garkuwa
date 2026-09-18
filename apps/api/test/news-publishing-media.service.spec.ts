import { ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';

import { NewsService } from '../src/modules/news/news.service.js';

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.test',
  name: 'Test Admin',
  role: 'ADMIN',
} as const;
const articleId = '22222222-2222-4222-8222-222222222222';
const mediaId = '33333333-3333-4333-8333-333333333333';
const originalUpdatedAt = new Date('2026-09-15T10:00:00.000Z');

function articleProjection(updatedAt = new Date('2026-09-15T10:01:00.000Z')) {
  return {
    id: articleId,
    createdAt: new Date('2026-09-15T09:00:00.000Z'),
    updatedAt,
    submittedForReviewAt: null,
    publishedAt: null,
    archivedAt: null,
    sources: [],
  };
}

describe('NewsService Phase 3 publishing operations', () => {
  it('sets featured, inline and ordered gallery media atomically with optimistic concurrency', async () => {
    const transaction = {
      newsArticle: {
        findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
          id: articleId,
          authorId: actor.id,
          status: 'DRAFT',
          updatedAt: originalUpdatedAt,
        }),
        updateMany: jest.fn<() => Promise<unknown>>().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn<() => Promise<unknown>>().mockResolvedValue(articleProjection()),
      },
      newsroomMedia: { count: jest.fn<() => Promise<unknown>>().mockResolvedValue(1) },
      newsArticleMedia: {
        deleteMany: jest.fn<() => Promise<unknown>>().mockResolvedValue({ count: 0 }),
        createMany: jest.fn<() => Promise<unknown>>().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: (operation: (tx: typeof transaction) => unknown) => operation(transaction),
    };
    const service = new NewsService(prisma as never, () => Date.parse('2026-09-15T10:01:00.000Z'));

    await service.updateMedia(
      articleId,
      {
        featuredMediaId: mediaId,
        socialMediaId: null,
        inlineMediaIds: [mediaId],
        galleryMediaIds: [mediaId],
        expectedUpdatedAt: originalUpdatedAt.toISOString(),
      },
      actor as never,
    );

    expect(transaction.newsArticleMedia.createMany).toHaveBeenCalledWith({
      data: [
        { articleId, mediaId, role: 'INLINE', displayOrder: 0 },
        { articleId, mediaId, role: 'GALLERY', displayOrder: 0 },
      ],
    });
    expect(transaction.newsArticle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: articleId, updatedAt: originalUpdatedAt } }),
    );
  });

  it('records a correction and public update timestamp in one transaction', async () => {
    const correction = {
      id: '44444444-4444-4444-8444-444444444444',
      noteHa: 'An gyara muhimmin lokaci a labarin.',
      noteEn: null,
      createdAt: new Date('2026-09-15T10:01:00.000Z'),
      createdBy: { id: actor.id, displayName: 'Test Admin' },
    };
    const transaction = {
      newsArticle: {
        findUnique: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValue({ status: 'PUBLISHED', updatedAt: originalUpdatedAt }),
        updateMany: jest.fn<() => Promise<unknown>>().mockResolvedValue({ count: 1 }),
      },
      newsArticleCorrection: {
        create: jest.fn<() => Promise<unknown>>().mockResolvedValue(correction),
      },
    };
    const prisma = {
      $transaction: (operation: (tx: typeof transaction) => unknown) => operation(transaction),
    };
    const service = new NewsService(prisma as never, () => correction.createdAt.getTime());

    const result = await service.addCorrection(
      articleId,
      {
        noteHa: correction.noteHa,
        noteEn: null,
        expectedUpdatedAt: originalUpdatedAt.toISOString(),
      },
      actor as never,
    );
    expect(transaction.newsArticleCorrection.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: actor.id }) }),
    );
    expect(transaction.newsArticle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publicUpdatedAt: correction.createdAt }),
      }),
    );
    expect(result.correction).not.toHaveProperty('passwordHash');
  });

  it('rejects breaking metadata for an unpublished draft', async () => {
    const prisma = {
      newsArticle: {
        findUnique: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValue({ status: 'DRAFT', updatedAt: originalUpdatedAt }),
      },
    };
    const service = new NewsService(prisma as never, () => originalUpdatedAt.getTime() + 1);
    await expect(
      service.updatePublishingMetadata(
        articleId,
        { isFeatured: false, isBreaking: true, expectedUpdatedAt: originalUpdatedAt.toISOString() },
        actor as never,
      ),
    ).rejects.toThrow(ConflictException);
  });
});
