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
  const revisionFindFirst =
    jest.fn<(input: unknown) => Promise<{ revisionNumber: number } | null>>();
  const revisionCreate = jest.fn<(input: unknown) => Promise<{ id: string }>>();
  const transactionClient = {
    newsArticle: { findUnique, updateMany, findUniqueOrThrow },
    newsArticleRevision: { findFirst: revisionFindFirst, create: revisionCreate },
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
    revisionFindFirst.mockResolvedValue({ revisionNumber: 1 });
    revisionCreate.mockResolvedValue({ id: 'revision-2' });
    findUnique.mockResolvedValue({
      id: articleId,
      authorId: actor.id,
      status: NewsArticleStatus.DRAFT,
      updatedAt: expected,
      draftRevisionId: 'revision-1',
      submittedRevisionId: null,
      submittedRevision: null,
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
          status: { in: [NewsArticleStatus.DRAFT, NewsArticleStatus.CHANGES_REQUESTED] },
          updatedAt: expected,
        },
        data: expect.not.objectContaining({ slug: expect.anything() }),
      }),
    );
    expect(result.article.slug).toBe('sanarwar-tsaro');
    expect(revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revisionNumber: 2, createdById: actor.id }),
      }),
    );
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

  it('classifies bilingual completeness only when English title, summary, and body are all present', async () => {
    const listService = new NewsService(
      {
        $transaction: jest.fn(async (operations: unknown[]) =>
          Promise.all(operations as Promise<unknown>[]),
        ),
        newsArticle: {
          count: jest.fn(async () => 2),
          findMany: jest.fn(async () => [
            {
              id: articleId,
              slug: 'one',
              status: NewsArticleStatus.DRAFT,
              titleHa: 'Title',
              titleEn: 'English title',
              summaryEn: null,
              bodyEn: null,
              createdAt: expected,
              updatedAt: expected,
              submittedForReviewAt: null,
              publishedAt: null,
              desk: null,
              dueAt: null,
              priority: 'NORMAL',
              author: { id: actor.id, displayName: actor.name },
              assignedWriter: null,
              assignedReviewer: null,
              category: { code: 'NEWS', slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
              securityAdvisory: null,
            },
            {
              id: '1f17f1a7-f1c8-46b9-8fec-bafd3964b543',
              slug: 'two',
              status: NewsArticleStatus.DRAFT,
              titleHa: 'Title',
              titleEn: 'English title',
              summaryEn: 'English summary',
              bodyEn: 'English body',
              createdAt: expected,
              updatedAt: expected,
              submittedForReviewAt: null,
              publishedAt: null,
              desk: null,
              dueAt: null,
              priority: 'NORMAL',
              author: { id: actor.id, displayName: actor.name },
              assignedWriter: null,
              assignedReviewer: null,
              category: { code: 'NEWS', slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
              securityAdvisory: null,
            },
          ]),
        },
      } as unknown as PrismaService,
      () => changed.getTime(),
    );

    const result = await listService.list({ page: 1, pageSize: 20, view: 'ALL' }, actor);
    expect(result.items[0]!.languageCompleteness).toBe('HAUSA_ONLY');
    expect(result.items[1]!.languageCompleteness).toBe('BILINGUAL');
  });

  it('redacts confidential source details for non-publisher roles in article detail responses', async () => {
    const detailService = new NewsService(
      {
        newsArticle: {
          findUnique: jest.fn(async () => ({
            id: articleId,
            slug: 'sanarwar-tsaro',
            status: NewsArticleStatus.IN_REVIEW,
            titleHa: 'Sanarwar Tsaro',
            summaryHa: 'Wannan taƙaitaccen bayanin gwaji ne na sashen edita.',
            bodyHa: `Cikakken rubutun gwaji ne. ${'Bayani '.repeat(20)}`,
            titleEn: null,
            summaryEn: null,
            bodyEn: null,
            createdAt: expected,
            updatedAt: changed,
            submittedForReviewAt: changed,
            publishedAt: null,
            archivedAt: null,
            draftRevisionId: 'draft-1',
            submittedRevisionId: 'submitted-1',
            publishedRevisionId: null,
            desk: null,
            dueAt: null,
            priority: 'NORMAL',
            author: { id: actor.id, displayName: actor.name },
            category: { code: 'NEWS', slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
            securityAdvisory: null,
            assignedWriter: null,
            assignedReviewer: null,
            revisions: [],
            contributors: [],
            tags: [],
            topics: [],
            locations: [],
            sources: [
              {
                id: 'source-public',
                type: 'OFFICIAL_STATEMENT',
                publicLabel: 'Official statement',
                url: 'https://example.org/statement',
                organization: 'Kaduna State Government',
                confidential: false,
                internalNotes: 'editorial-only note',
              },
              {
                id: 'source-confidential',
                type: 'INTERVIEW',
                publicLabel: null,
                url: 'https://example.org/private',
                organization: 'Private witness',
                confidential: true,
                internalNotes: 'do not disclose identity',
              },
            ],
            assignmentHistory: [],
          })),
        },
        newsArticleSourceAccessAudit: {
          createMany: jest.fn(async () => ({ count: 1 })),
        },
      } as unknown as PrismaService,
      () => changed.getTime(),
    );

    const editor = await detailService.detail(articleId, actor);
    expect(editor.article.sources[0]).toMatchObject({
      url: 'https://example.org/statement',
      internalNotes: null,
    });
    expect(editor.article.sources[1]).toMatchObject({
      url: null,
      organization: null,
      internalNotes: null,
    });

    const admin = await detailService.detail(articleId, {
      ...actor,
      role: StaffRole.ADMIN,
    });
    expect(admin.article.sources[1]).toMatchObject({
      url: 'https://example.org/private',
      organization: 'Private witness',
      internalNotes: 'do not disclose identity',
    });
  });
});
