import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { NewsArticleStatus } from '../../../generated/prisma/enums.js';
import type { PublicNewsLanguage, PublicNewsQuery } from './dto/public-news.dto.js';

export const PUBLIC_NEWS_CLOCK = Symbol('PUBLIC_NEWS_CLOCK');

const completeEnglishTranslation: Prisma.NewsArticleWhereInput = {
  AND: [
    { titleEn: { not: null } },
    { titleEn: { not: '' } },
    { summaryEn: { not: null } },
    { summaryEn: { not: '' } },
    { bodyEn: { not: null } },
    { bodyEn: { not: '' } },
  ],
};

function visibilityWhere(language: PublicNewsLanguage, now: Date): Prisma.NewsArticleWhereInput {
  return {
    status: NewsArticleStatus.PUBLISHED,
    publishedAt: { not: null, lte: now },
    ...(language === 'en' ? completeEnglishTranslation : {}),
  };
}

function publicNotFound(): NotFoundException {
  return new NotFoundException('Published article not found.');
}

@Injectable()
export class PublicNewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PUBLIC_NEWS_CLOCK) private readonly clock: () => number,
  ) {}

  async list(query: PublicNewsQuery) {
    const where = visibilityWhere(query.lang, new Date(this.clock()));
    const select =
      query.lang === 'en'
        ? {
            slug: true,
            titleEn: true,
            summaryEn: true,
            publishedAt: true,
          }
        : {
            slug: true,
            titleHa: true,
            summaryHa: true,
            publishedAt: true,
            titleEn: true,
            summaryEn: true,
            bodyEn: true,
          };
    const [totalItems, articles] = await this.prisma.$transaction([
      this.prisma.newsArticle.count({ where }),
      this.prisma.newsArticle.findMany({
        where,
        select,
        orderBy: [{ publishedAt: 'desc' }, { slug: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const items = articles.map((article) =>
      query.lang === 'en'
        ? {
            slug: article.slug,
            title: article.titleEn!,
            summary: article.summaryEn!,
            publishedAt: article.publishedAt!.toISOString(),
            hasEnglishTranslation: true,
          }
        : {
            slug: article.slug,
            title: article.titleHa,
            summary: article.summaryHa,
            publishedAt: article.publishedAt!.toISOString(),
            hasEnglishTranslation: Boolean(article.titleEn && article.summaryEn && article.bodyEn),
          },
    );

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async detail(slug: string, language: PublicNewsLanguage) {
    const where = {
      slug,
      ...visibilityWhere(language, new Date(this.clock())),
    };
    if (language === 'en') {
      const article = await this.prisma.newsArticle.findFirst({
        where,
        select: {
          slug: true,
          titleEn: true,
          summaryEn: true,
          bodyEn: true,
          publishedAt: true,
        },
      });
      if (!article?.publishedAt) throw publicNotFound();
      return {
        slug: article.slug,
        title: article.titleEn!,
        summary: article.summaryEn!,
        body: article.bodyEn!,
        publishedAt: article.publishedAt.toISOString(),
        hasEnglishTranslation: true,
      };
    }

    const article = await this.prisma.newsArticle.findFirst({
      where,
      select: {
        slug: true,
        titleHa: true,
        summaryHa: true,
        bodyHa: true,
        publishedAt: true,
        titleEn: true,
        summaryEn: true,
        bodyEn: true,
      },
    });
    if (!article?.publishedAt) throw publicNotFound();
    return {
      slug: article.slug,
      title: article.titleHa,
      summary: article.summaryHa,
      body: article.bodyHa,
      publishedAt: article.publishedAt.toISOString(),
      hasEnglishTranslation: Boolean(article.titleEn && article.summaryEn && article.bodyEn),
    };
  }
}
