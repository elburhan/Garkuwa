import { NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';

import { NewsArticleStatus } from '../src/generated/prisma/enums.js';
import { PublicNewsService } from '../src/modules/news/public/public-news.service.js';

const now = new Date('2026-07-29T12:00:00.000Z');
const publishedAt = new Date('2026-07-29T10:00:00.000Z');

describe('PublicNewsService', () => {
  const count = jest.fn<(parameters: unknown) => Promise<number>>();
  const findMany = jest.fn<(parameters: unknown) => Promise<unknown[]>>();
  const findFirst = jest.fn<(parameters: unknown) => Promise<unknown>>();
  const transaction = jest.fn((operations: Promise<unknown>[]) => Promise.all(operations));
  const prisma = {
    newsArticle: { count, findMany, findFirst },
    $transaction: transaction,
  };
  const service = new PublicNewsService(prisma as never, () => now.getTime());

  beforeEach(() => jest.clearAllMocks());

  it('lists only directly query-filtered current published Hausa articles', async () => {
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([
      {
        slug: 'sanarwar-tsaro',
        titleHa: 'Sanarwar Tsaro',
        summaryHa: 'Taƙaitaccen bayanin sanarwar jama’a.',
        publishedAt,
        titleEn: null,
        summaryEn: null,
        bodyEn: null,
        publicUpdatedAt: null,
        isFeatured: false,
        isBreaking: false,
        featuredMedia: null,
        category: { slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
        securityAdvisory: null,
      },
    ]);

    const result = await service.list({ lang: 'ha', page: 1, pageSize: 10 });
    const call = findMany.mock.calls[0]![0] as Record<string, unknown>;
    expect(call).toMatchObject({
      where: {
        status: NewsArticleStatus.PUBLISHED,
        publishedAt: { not: null, lte: now },
      },
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }, { slug: 'desc' }],
      skip: 0,
      take: 10,
    });
    expect(call).not.toHaveProperty('include');
    expect(result).toEqual({
      generatedAt: now.toISOString(),
      items: [
        {
          slug: 'sanarwar-tsaro',
          title: 'Sanarwar Tsaro',
          summary: 'Taƙaitaccen bayanin sanarwar jama’a.',
          publishedAt: publishedAt.toISOString(),
          updatedAt: publishedAt.toISOString(),
          isFeatured: false,
          isBreaking: false,
          featuredMedia: null,
          hasEnglishTranslation: false,
          category: { slug: 'news', name: 'Labarai' },
          contributors: [],
          securityAdvisory: null,
        },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
  });

  it('requires complete English translation in the database query and returns English only', async () => {
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([
      {
        slug: 'sanarwar-tsaro',
        titleEn: 'Safety notice',
        summaryEn: 'A concise public safety notice.',
        publishedAt,
        publicUpdatedAt: null,
        isFeatured: false,
        isBreaking: false,
        featuredMedia: null,
        category: { slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
        securityAdvisory: null,
      },
    ]);

    const result = await service.list({ lang: 'en', page: 2, pageSize: 3 });
    const call = findMany.mock.calls[0]![0] as {
      where: { AND: unknown[] };
      select: Record<string, boolean>;
      skip: number;
    };
    expect(call.where.AND).toEqual(
      expect.arrayContaining([
        { titleEn: { not: null } },
        { titleEn: { not: '' } },
        { summaryEn: { not: null } },
        { bodyEn: { not: null } },
      ]),
    );
    expect(call.select).toEqual(
      expect.objectContaining({
        slug: true,
        titleEn: true,
        summaryEn: true,
        publishedAt: true,
      }),
    );
    expect(call.skip).toBe(3);
    expect(result.items[0]).toEqual({
      slug: 'sanarwar-tsaro',
      title: 'Safety notice',
      summary: 'A concise public safety notice.',
      publishedAt: publishedAt.toISOString(),
      updatedAt: publishedAt.toISOString(),
      isFeatured: false,
      isBreaking: false,
      featuredMedia: null,
      hasEnglishTranslation: true,
      category: { slug: 'news', name: 'News' },
      contributors: [],
      securityAdvisory: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/titleHa|summaryHa|status|author|createdAt/);
  });

  it('uses the same published-only query and safe not-found result for hidden and unknown detail', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.detail('boyayyen-rubutu', 'ha')).rejects.toThrow(NotFoundException);
    const call = findFirst.mock.calls[0]![0] as Record<string, unknown>;
    expect(call).toMatchObject({
      where: {
        slug: 'boyayyen-rubutu',
        status: NewsArticleStatus.PUBLISHED,
        publishedAt: { not: null, lte: now },
      },
    });
    expect(call).not.toHaveProperty('include');
  });

  it('returns paragraph-preserving localized detail without internal fields or fallback', async () => {
    findFirst.mockResolvedValue({
      slug: 'sanarwar-tsaro',
      titleEn: 'Safety notice',
      summaryEn: 'A concise public safety notice.',
      bodyEn: 'First paragraph.\n\nSecond paragraph.',
      publishedAt,
      publicUpdatedAt: null,
      isFeatured: false,
      isBreaking: false,
      featuredMedia: null,
      socialMedia: null,
      publishedRevision: null,
      media: [],
      corrections: [],
      category: { slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
      securityAdvisory: null,
    });
    const result = await service.detail('sanarwar-tsaro', 'en');
    expect(result).toEqual({
      slug: 'sanarwar-tsaro',
      title: 'Safety notice',
      summary: 'A concise public safety notice.',
      body: 'First paragraph.\n\nSecond paragraph.',
      publishedAt: publishedAt.toISOString(),
      updatedAt: publishedAt.toISOString(),
      isFeatured: false,
      isBreaking: false,
      featuredMedia: null,
      socialMedia: null,
      gallery: [],
      bodyBlocks: null,
      corrections: [],
      hasEnglishTranslation: true,
      category: { slug: 'news', name: 'News' },
      contributors: [],
      securityAdvisory: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/status|author|history|reason|titleHa|bodyHa|id/);
  });
});
