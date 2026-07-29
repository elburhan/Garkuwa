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

function visibilityWhere(
  language: PublicNewsLanguage,
  now: Date,
  categorySlug?: string,
): Prisma.NewsArticleWhereInput {
  return {
    status: NewsArticleStatus.PUBLISHED,
    publishedAt: { not: null, lte: now },
    category: { isActive: true, ...(categorySlug ? { slug: categorySlug } : {}) },
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
    const generatedAt = new Date(this.clock());
    const where = visibilityWhere(query.lang, generatedAt, query.category);
    const category = { select: { slug: true, nameHa: true, nameEn: true } } as const;
    const select =
      query.lang === 'en'
        ? {
            slug: true,
            titleEn: true,
            summaryEn: true,
            publishedAt: true,
            category,
          }
        : {
            slug: true,
            titleHa: true,
            summaryHa: true,
            publishedAt: true,
            titleEn: true,
            summaryEn: true,
            bodyEn: true,
            category,
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
            category: { slug: article.category.slug, name: article.category.nameEn },
          }
        : {
            slug: article.slug,
            title: article.titleHa,
            summary: article.summaryHa,
            publishedAt: article.publishedAt!.toISOString(),
            hasEnglishTranslation: Boolean(article.titleEn && article.summaryEn && article.bodyEn),
            category: { slug: article.category.slug, name: article.category.nameHa },
          },
    );

    return {
      generatedAt: generatedAt.toISOString(),
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
          category: { select: { slug: true, nameEn: true } },
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
        category: { slug: article.category.slug, name: article.category.nameEn },
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
        category: { select: { slug: true, nameHa: true } },
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
      category: { slug: article.category.slug, name: article.category.nameHa },
    };
  }
}
