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
} as const;

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
              ...input,
              slug,
              authorId: actor.id,
              status: NewsArticleStatus.DRAFT,
              createdAt,
              updatedAt: createdAt,
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
      const { expectedUpdatedAt: expectedUpdatedAtValue, ...content } = input;
      const expectedUpdatedAt = new Date(expectedUpdatedAtValue);
      if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
      const updatedAt = nextTimestamp(existing.updatedAt, this.clock);
      const result = await transaction.newsArticle.updateMany({
        where: { id: articleId, status: NewsArticleStatus.DRAFT, updatedAt: expectedUpdatedAt },
        data: { ...content, updatedAt },
      });
      if (result.count !== 1) throw conflict();
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
        select: { id: true, authorId: true, status: true, updatedAt: true },
      });
      if (!existing) throw new NotFoundException('Article not found.');
      const targetStatus = assertEditorialDecisionAllowed(
        existing.status,
        existing.authorId,
        input.decision,
        actor,
      );
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
}
