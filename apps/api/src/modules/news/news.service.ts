import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { NewsArticleStatus } from '../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../auth/auth.types.js';
import type {
  CreateNewsArticleDto,
  ListNewsArticlesQuery,
  NewsArticleDecisionDto,
  UpdateNewsArticleDto,
} from './dto/news.dto.js';
import { assertCanEditDraft, assertEditorialDecisionAllowed } from './news-editorial-policy.js';
import { createNewsSlugBase, newsSlugCandidate } from './news-slug.js';

export const NEWS_EDITORIAL_CLOCK = Symbol('NEWS_EDITORIAL_CLOCK');
const minimalActorSelect = { id: true, displayName: true } as const;
const categorySelect = { code: true, slug: true, nameHa: true, nameEn: true } as const;
const advisoryDetailSelect = {
  severity: true,
  affectedAreaHa: true,
  affectedAreaEn: true,
  recommendedActionsHa: true,
  recommendedActionsEn: true,
  referencesJson: true,
} as const;
const articleSelect = {
  id: true,
  slug: true,
  status: true,
  titleHa: true,
  summaryHa: true,
  bodyHa: true,
  titleEn: true,
  summaryEn: true,
  bodyEn: true,
  createdAt: true,
  updatedAt: true,
  submittedForReviewAt: true,
  publishedAt: true,
  archivedAt: true,
  author: { select: minimalActorSelect },
  category: { select: categorySelect },
  securityAdvisory: { select: advisoryDetailSelect },
} as const;

function advisoryData(input: CreateNewsArticleDto | UpdateNewsArticleDto) {
  const advisory = input.securityAdvisory;
  if (!advisory) return null;
  return {
    severity: advisory.severity,
    affectedAreaHa: advisory.affectedAreaHa,
    affectedAreaEn: advisory.affectedAreaEn,
    recommendedActionsHa: advisory.recommendedActionsHa,
    recommendedActionsEn: advisory.recommendedActionsEn,
    referencesJson: advisory.references,
  };
}

function conflict(): ConflictException {
  return new ConflictException('The article changed and must be refreshed.');
}

function nextTimestamp(current: Date, clock: () => number): Date {
  return new Date(Math.max(clock(), current.getTime() + 1));
}

function serializeArticle<
  Article extends {
    createdAt: Date;
    updatedAt: Date;
    submittedForReviewAt: Date | null;
    publishedAt: Date | null;
    archivedAt: Date | null;
  },
>(article: Article) {
  return {
    ...article,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    submittedForReviewAt: article.submittedForReviewAt?.toISOString() ?? null,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    archivedAt: article.archivedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class NewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NEWS_EDITORIAL_CLOCK) private readonly clock: () => number,
  ) {}

  async list(query: ListNewsArticlesQuery) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.category ? { category: { code: query.category } } : {}),
      ...(query.severity ? { securityAdvisory: { severity: query.severity } } : {}),
    };
    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.newsArticle.count({ where }),
      this.prisma.newsArticle.findMany({
        where,
        select: {
          id: true,
          slug: true,
          status: true,
          titleHa: true,
          titleEn: true,
          createdAt: true,
          updatedAt: true,
          author: { select: minimalActorSelect },
          category: { select: categorySelect },
          securityAdvisory: { select: { severity: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: items.map((article) => ({
        ...article,
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async create(input: CreateNewsArticleDto, actor: StaffPrincipal) {
    const category = await this.activeCategory(input.categoryCode);
    const content = {
      titleHa: input.titleHa,
      summaryHa: input.summaryHa,
      bodyHa: input.bodyHa,
      titleEn: input.titleEn,
      summaryEn: input.summaryEn,
      bodyEn: input.bodyEn,
    };
    const base = createNewsSlugBase(input.titleHa);
    for (let collision = 1; collision <= 100; collision += 1) {
      const slug = newsSlugCandidate(base, collision);
      const exists = await this.prisma.newsArticle.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (exists) continue;
      const createdAt = new Date(this.clock());
      try {
        return await this.prisma.$transaction(async (transaction) => {
          const article = await transaction.newsArticle.create({
            data: {
              ...content,
              categoryId: category.id,
              slug,
              authorId: actor.id,
              status: NewsArticleStatus.DRAFT,
              createdAt,
              updatedAt: createdAt,
              ...(advisoryData(input)
                ? { securityAdvisory: { create: advisoryData(input)! } }
                : {}),
            },
            select: articleSelect,
          });
          await transaction.newsArticleStatusHistory.create({
            data: {
              articleId: article.id,
              fromStatus: null,
              toStatus: NewsArticleStatus.DRAFT,
              actorId: actor.id,
              createdAt,
            },
            select: { id: true },
          });
          return { article: serializeArticle(article) };
        });
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('A unique article slug could not be allocated.');
  }

  async detail(articleId: string) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { id: articleId },
      select: articleSelect,
    });
    if (!article) throw new NotFoundException('Article not found.');
    return { article: serializeArticle(article) };
  }

  async update(articleId: string, input: UpdateNewsArticleDto, actor: StaffPrincipal) {
    const category = await this.activeCategory(input.categoryCode);
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.newsArticle.findUnique({
        where: { id: articleId },
        select: { id: true, authorId: true, status: true, updatedAt: true },
      });
      if (!existing) throw new NotFoundException('Article not found.');
      if (existing.status !== NewsArticleStatus.DRAFT) {
        throw new ConflictException('Only draft articles can be edited.');
      }
      assertCanEditDraft(existing.authorId, actor);
      const expectedUpdatedAtValue = input.expectedUpdatedAt;
      const content = {
        titleHa: input.titleHa,
        summaryHa: input.summaryHa,
        bodyHa: input.bodyHa,
        titleEn: input.titleEn,
        summaryEn: input.summaryEn,
        bodyEn: input.bodyEn,
      };
      const expectedUpdatedAt = new Date(expectedUpdatedAtValue);
      if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
      const updatedAt = nextTimestamp(existing.updatedAt, this.clock);
      const result = await transaction.newsArticle.updateMany({
        where: { id: articleId, status: NewsArticleStatus.DRAFT, updatedAt: expectedUpdatedAt },
        data: { ...content, categoryId: category.id, updatedAt },
      });
      if (result.count !== 1) throw conflict();
      const advisory = advisoryData(input);
      if (advisory) {
        await transaction.newsSecurityAdvisory.upsert({
          where: { articleId },
          create: { articleId, ...advisory },
          update: advisory,
          select: { articleId: true },
        });
      } else {
        await transaction.newsSecurityAdvisory.deleteMany({ where: { articleId } });
      }
      const article = await transaction.newsArticle.findUniqueOrThrow({
        where: { id: articleId },
        select: articleSelect,
      });
      return { article: serializeArticle(article) };
    });
  }

  async transition(articleId: string, input: NewsArticleDecisionDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.newsArticle.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          authorId: true,
          status: true,
          updatedAt: true,
          titleEn: true,
          summaryEn: true,
          bodyEn: true,
          category: { select: { isActive: true, code: true } },
          securityAdvisory: {
            select: {
              severity: true,
              affectedAreaHa: true,
              affectedAreaEn: true,
              recommendedActionsHa: true,
              recommendedActionsEn: true,
            },
          },
        },
      });
      if (!existing) throw new NotFoundException('Article not found.');
      const targetStatus = assertEditorialDecisionAllowed(
        existing.status,
        existing.authorId,
        input.decision,
        actor,
      );
      if (
        (input.decision === 'SUBMIT_FOR_REVIEW' || input.decision === 'APPROVE_PUBLICATION') &&
        !existing.category.isActive
      ) {
        throw new ConflictException('The article category is unavailable.');
      }
      if (
        (input.decision === 'SUBMIT_FOR_REVIEW' || input.decision === 'APPROVE_PUBLICATION') &&
        existing.category.code === 'SECURITY_ADVISORIES' &&
        (!existing.securityAdvisory ||
          Boolean(existing.titleEn && existing.summaryEn && existing.bodyEn) !==
            Boolean(
              existing.securityAdvisory?.affectedAreaEn &&
              existing.securityAdvisory.recommendedActionsEn,
            ))
      ) {
        throw new ConflictException('The structured security advisory is incomplete.');
      }
      const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
      if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
      const changedAt = nextTimestamp(existing.updatedAt, this.clock);
      const timestamps =
        input.decision === 'SUBMIT_FOR_REVIEW'
          ? { submittedForReviewAt: changedAt }
          : input.decision === 'APPROVE_PUBLICATION'
            ? { publishedAt: changedAt }
            : input.decision === 'ARCHIVE'
              ? { archivedAt: changedAt }
              : {};
      const result = await transaction.newsArticle.updateMany({
        where: { id: articleId, status: existing.status, updatedAt: expectedUpdatedAt },
        data: { status: targetStatus, updatedAt: changedAt, ...timestamps },
      });
      if (result.count !== 1) throw conflict();
      const history = await transaction.newsArticleStatusHistory.create({
        data: {
          articleId,
          fromStatus: existing.status,
          toStatus: targetStatus,
          actorId: actor.id,
          reason: input.reason ?? null,
          createdAt: changedAt,
        },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
          actor: { select: minimalActorSelect },
        },
      });
      return {
        article: { id: articleId, status: targetStatus, updatedAt: changedAt.toISOString() },
        historyEntry: { ...history, createdAt: history.createdAt.toISOString() },
      };
    });
  }

  async history(articleId: string) {
    const exists = await this.prisma.newsArticle.findUnique({
      where: { id: articleId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Article not found.');
    const items = await this.prisma.newsArticleStatusHistory.findMany({
      where: { articleId },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        createdAt: true,
        actor: { select: minimalActorSelect },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    };
  }

  async categories() {
    const items = await this.prisma.newsCategory.findMany({
      where: { isActive: true },
      select: {
        code: true,
        slug: true,
        nameHa: true,
        nameEn: true,
        descriptionHa: true,
        descriptionEn: true,
        displayOrder: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      take: 6,
    });
    return { items };
  }

  private async activeCategory(code: string) {
    const category = await this.prisma.newsCategory.findFirst({
      where: { code, isActive: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('News category not found or unavailable.');
    return category;
  }
}
