import { ConflictException, ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import { NewsArticleStatus, StaffRole } from '../src/generated/prisma/enums.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import { NewsService } from '../src/modules/news/news.service.js';

const articleId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const expected = new Date('2026-07-29T10:00:00.000Z');
const changed = new Date('2026-07-29T10:05:00.000Z');
const actor: StaffPrincipal = {
  id: 'author-id',
  email: 'editor@example.test',
  name: 'Editor',
  role: StaffRole.EDITOR,
};
const content = {
  categoryCode: 'NEWS' as const,
  securityAdvisory: null,
  titleHa: 'Sanarwar Tsaro',
  summaryHa: 'Wannan taƙaitaccen bayanin gwaji ne na sashen edita.',
  bodyHa: `Cikakken rubutun gwaji ne. ${'Bayani '.repeat(20)}`,
  titleEn: null,
  summaryEn: null,
  bodyEn: null,
  expectedUpdatedAt: expected.toISOString(),
};

describe('NewsService', () => {
  const findUnique = jest.fn<(input: unknown) => Promise<unknown>>();
  const updateMany = jest.fn<(input: unknown) => Promise<{ count: number }>>();
  const findUniqueOrThrow = jest.fn<(input: unknown) => Promise<unknown>>();
  const historyCreate = jest.fn<(input: unknown) => Promise<unknown>>();
  const categoryFindFirst = jest.fn<(input: unknown) => Promise<unknown>>();
  const advisoryDeleteMany = jest.fn<(input: unknown) => Promise<unknown>>();
  const advisoryUpsert = jest.fn<(input: unknown) => Promise<unknown>>();
  const transactionClient = {
    newsArticle: { findUnique, updateMany, findUniqueOrThrow },
    newsArticleStatusHistory: { create: historyCreate },
    newsSecurityAdvisory: { deleteMany: advisoryDeleteMany, upsert: advisoryUpsert },
  };
  const transaction = jest.fn(async (callback: (client: typeof transactionClient) => unknown) =>
    callback(transactionClient),
  );
  const prisma = {
    $transaction: transaction,
    newsCategory: { findFirst: categoryFindFirst },
  } as unknown as PrismaService;
  const service = new NewsService(prisma, () => changed.getTime());

  beforeEach(() => {
    jest.clearAllMocks();
    categoryFindFirst.mockResolvedValue({ id: 'category-id' });
    findUnique.mockResolvedValue({
      id: articleId,
      authorId: actor.id,
      status: NewsArticleStatus.DRAFT,
      updatedAt: expected,
      category: { isActive: true },
    });
    updateMany.mockResolvedValue({ count: 1 });
    findUniqueOrThrow.mockResolvedValue({
      id: articleId,
      slug: 'sanarwar-tsaro',
      status: NewsArticleStatus.DRAFT,
      ...content,
      createdAt: expected,
      updatedAt: changed,
      submittedForReviewAt: null,
      publishedAt: null,
      archivedAt: null,
      author: { id: actor.id, displayName: actor.name },
      category: { code: 'NEWS', slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
    });
    historyCreate.mockResolvedValue({
      id: 'history-id',
      fromStatus: NewsArticleStatus.DRAFT,
      toStatus: NewsArticleStatus.IN_REVIEW,
      reason: null,
      createdAt: changed,
      actor: { id: actor.id, displayName: actor.name },
    });
  });

  it('conditionally edits only an owned draft and keeps the slug stable', async () => {
    const result = await service.update(articleId, content, actor);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: articleId,
          status: NewsArticleStatus.DRAFT,
          updatedAt: expected,
        },
        data: expect.not.objectContaining({ slug: expect.anything() }),
      }),
    );
    expect(result.article.slug).toBe('sanarwar-tsaro');
  });

  it('blocks another editor and stale content without writing', async () => {
    findUnique.mockResolvedValueOnce({
      id: articleId,
      authorId: 'other-author',
      status: NewsArticleStatus.DRAFT,
      updatedAt: expected,
      category: { isActive: true },
    });
    await expect(service.update(articleId, content, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    findUnique.mockResolvedValueOnce({
      id: articleId,
      authorId: actor.id,
      status: NewsArticleStatus.DRAFT,
      updatedAt: new Date(expected.getTime() + 1),
      category: { isActive: true },
    });
    await expect(service.update(articleId, content, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('updates status and immutable history in one transaction', async () => {
    const result = await service.transition(
      articleId,
      { decision: 'SUBMIT_FOR_REVIEW', expectedUpdatedAt: expected.toISOString() },
      actor,
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: articleId,
          status: NewsArticleStatus.DRAFT,
          updatedAt: expected,
        },
        data: expect.objectContaining({
          status: NewsArticleStatus.IN_REVIEW,
          submittedForReviewAt: changed,
        }),
      }),
    );
    expect(historyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: NewsArticleStatus.DRAFT,
          toStatus: NewsArticleStatus.IN_REVIEW,
          actorId: actor.id,
        }),
      }),
    );
    expect(result.article.updatedAt).toBe(changed.toISOString());
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('does not insert history when the conditional status mutation loses a race', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.transition(
        articleId,
        { decision: 'SUBMIT_FOR_REVIEW', expectedUpdatedAt: expected.toISOString() },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(historyCreate).not.toHaveBeenCalled();
  });
});
