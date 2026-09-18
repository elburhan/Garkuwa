import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { NewsArticleStatus } from '../../generated/prisma/enums.js';
import { StaffRole, UserStatus } from '../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../auth/auth.types.js';
import { hasNewsroomCapability } from '../auth/newsroom-capabilities.js';
import type {
  CreateNewsArticleDto,
  ListNewsArticlesQuery,
  NewsArticleAssignmentDto,
  NewsArticleCorrectionDto,
  NewsArticleMediaDto,
  NewsArticleMetadataDto,
  NewsArticlePublishingMetadataDto,
  ContributorCreateDto,
  TagCreateDto,
  TopicCreateDto,
  TagUpdateDto,
  TopicUpdateDto,
  ContributorUpdateDto,
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
const revisionSelect = {
  id: true,
  revisionNumber: true,
  titleHa: true,
  summaryHa: true,
  bodyHa: true,
  bodyBlocksHa: true,
  titleEn: true,
  summaryEn: true,
  bodyEn: true,
  bodyBlocksEn: true,
  changeNote: true,
  createdAt: true,
  createdBy: { select: minimalActorSelect },
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
  draftRevisionId: true,
  submittedRevisionId: true,
  publishedRevisionId: true,
  desk: true,
  dueAt: true,
  priority: true,
  isFeatured: true,
  isBreaking: true,
  publicUpdatedAt: true,
  author: { select: minimalActorSelect },
  category: { select: categorySelect },
  securityAdvisory: { select: advisoryDetailSelect },
  assignedWriter: { select: minimalActorSelect },
  assignedReviewer: { select: minimalActorSelect },
  revisions: { select: revisionSelect, orderBy: { revisionNumber: 'desc' as const }, take: 25 },
  contributors: {
    select: {
      role: true,
      displayOrder: true,
      contributor: { select: { id: true, displayName: true, slug: true, publicStatus: true } },
    },
    orderBy: { displayOrder: 'asc' as const },
  },
  tags: { select: { tag: { select: { id: true, slug: true, name: true } } } },
  topics: { select: { topic: { select: { id: true, slug: true, nameHa: true, nameEn: true } } } },
  locations: {
    select: { id: true, country: true, state: true, lga: true, place: true },
    orderBy: { id: 'asc' as const },
  },
  sources: {
    select: {
      id: true,
      type: true,
      publicLabel: true,
      url: true,
      organization: true,
      confidential: true,
      internalNotes: true,
      displayOrder: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  assignmentHistory: {
    select: {
      id: true,
      fromDesk: true,
      toDesk: true,
      fromDueAt: true,
      toDueAt: true,
      fromPriority: true,
      toPriority: true,
      reason: true,
      createdAt: true,
      fromWriter: { select: minimalActorSelect },
      toWriter: { select: minimalActorSelect },
      fromReviewer: { select: minimalActorSelect },
      toReviewer: { select: minimalActorSelect },
      changedBy: { select: minimalActorSelect },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  featuredMedia: {
    select: {
      id: true,
      mimeType: true,
      width: true,
      height: true,
      altTextHa: true,
      altTextEn: true,
      captionHa: true,
      captionEn: true,
      credit: true,
    },
  },
  socialMedia: { select: { id: true } },
  media: {
    select: {
      role: true,
      displayOrder: true,
      media: {
        select: {
          id: true,
          mimeType: true,
          width: true,
          height: true,
          altTextHa: true,
          altTextEn: true,
          captionHa: true,
          captionEn: true,
          credit: true,
        },
      },
    },
    orderBy: { displayOrder: 'asc' as const },
  },
  corrections: {
    select: {
      id: true,
      noteHa: true,
      noteEn: true,
      createdAt: true,
      createdBy: { select: minimalActorSelect },
    },
    orderBy: { createdAt: 'asc' as const },
  },
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

function canViewConfidentialSourceDetails(actor: StaffPrincipal): boolean {
  return (
    hasNewsroomCapability(actor.role, 'NEWS_PUBLISH') ||
    hasNewsroomCapability(actor.role, 'STAFF_MANAGE')
  );
}

type SerializableSource = {
  id: string;
  type: string;
  publicLabel: string | null;
  url: string | null;
  organization: string | null;
  confidential: boolean;
  internalNotes: string | null;
};

function redactArticleSources<T extends { sources?: SerializableSource[] }>(
  article: T,
  actor: StaffPrincipal,
): T {
  if (!article.sources) return article;
  if (canViewConfidentialSourceDetails(actor)) return article;
  return {
    ...article,
    sources: article.sources.map((source) => ({
      ...source,
      url: source.confidential ? null : source.url,
      organization: source.confidential ? null : source.organization,
      internalNotes: null,
    })),
  };
}

function serializeArticle<
  Article extends {
    createdAt: Date;
    updatedAt: Date;
    submittedForReviewAt: Date | null;
    publishedAt: Date | null;
    archivedAt: Date | null;
    publicUpdatedAt?: Date | null;
    dueAt?: Date | null;
    revisions?: readonly { createdAt: Date }[];
    assignmentHistory?: readonly {
      createdAt: Date;
      fromDueAt: Date | null;
      toDueAt: Date | null;
    }[];
    corrections?: readonly { createdAt: Date }[];
  },
>(article: Article) {
  return {
    ...article,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    submittedForReviewAt: article.submittedForReviewAt?.toISOString() ?? null,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    archivedAt: article.archivedAt?.toISOString() ?? null,
    ...(article.publicUpdatedAt !== undefined
      ? { publicUpdatedAt: article.publicUpdatedAt?.toISOString() ?? null }
      : {}),
    ...(article.dueAt !== undefined ? { dueAt: article.dueAt?.toISOString() ?? null } : {}),
    ...(article.revisions
      ? {
          revisions: article.revisions.map((revision) => ({
            ...revision,
            createdAt: revision.createdAt.toISOString(),
          })),
        }
      : {}),
    ...(article.assignmentHistory
      ? {
          assignmentHistory: article.assignmentHistory.map((entry) => ({
            ...entry,
            fromDueAt: entry.fromDueAt?.toISOString() ?? null,
            toDueAt: entry.toDueAt?.toISOString() ?? null,
            createdAt: entry.createdAt.toISOString(),
          })),
        }
      : {}),
    ...(article.corrections
      ? {
          corrections: article.corrections.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
          })),
        }
      : {}),
  };
}

@Injectable()
export class NewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NEWS_EDITORIAL_CLOCK) private readonly clock: () => number,
  ) {}

  async list(query: ListNewsArticlesQuery, actor: StaffPrincipal) {
    const startOfToday = new Date(this.clock());
    startOfToday.setUTCHours(0, 0, 0, 0);
    const viewWhere: Prisma.NewsArticleWhereInput =
      query.view === 'MY_DRAFTS'
        ? {
            authorId: actor.id,
            status: { in: [NewsArticleStatus.DRAFT, NewsArticleStatus.CHANGES_REQUESTED] },
          }
        : query.view === 'ASSIGNED_TO_ME'
          ? { OR: [{ assignedWriterId: actor.id }, { assignedReviewerId: actor.id }] }
          : query.view === 'NEEDS_REVIEW'
            ? { status: NewsArticleStatus.IN_REVIEW }
            : query.view === 'CHANGES_REQUESTED'
              ? { status: NewsArticleStatus.CHANGES_REQUESTED }
              : query.view === 'READY_TO_PUBLISH'
                ? { status: NewsArticleStatus.READY_TO_PUBLISH }
                : query.view === 'PUBLISHED_TODAY'
                  ? { status: NewsArticleStatus.PUBLISHED, publishedAt: { gte: startOfToday } }
                  : {};
    const where: Prisma.NewsArticleWhereInput = {
      AND: [viewWhere],
      ...(query.status ? { status: query.status } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.assignedWriterId ? { assignedWriterId: query.assignedWriterId } : {}),
      ...(query.assignedReviewerId ? { assignedReviewerId: query.assignedReviewerId } : {}),
      ...(query.desk ? { desk: query.desk } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.language === 'BILINGUAL'
        ? { titleEn: { not: null }, summaryEn: { not: null }, bodyEn: { not: null } }
        : query.language === 'HAUSA_ONLY'
          ? {
              OR: [{ titleEn: null }, { summaryEn: null }, { bodyEn: null }],
            }
          : {}),
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
          summaryEn: true,
          bodyEn: true,
          createdAt: true,
          updatedAt: true,
          submittedForReviewAt: true,
          publishedAt: true,
          desk: true,
          dueAt: true,
          priority: true,
          author: { select: minimalActorSelect },
          assignedWriter: { select: minimalActorSelect },
          assignedReviewer: { select: minimalActorSelect },
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
        submittedForReviewAt: article.submittedForReviewAt?.toISOString() ?? null,
        publishedAt: article.publishedAt?.toISOString() ?? null,
        dueAt: article.dueAt?.toISOString() ?? null,
        languageCompleteness:
          article.titleEn && article.summaryEn && article.bodyEn
            ? ('BILINGUAL' as const)
            : ('HAUSA_ONLY' as const),
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
    const revisionContent = {
      ...content,
      bodyBlocksHa: input.bodyBlocksHa,
      bodyBlocksEn: input.bodyBlocksEn,
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
          const created = await transaction.newsArticle.create({
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
            select: { id: true },
          });
          const revision = await transaction.newsArticleRevision.create({
            data: {
              articleId: created.id,
              revisionNumber: 1,
              ...revisionContent,
              createdById: actor.id,
              changeNote: input.changeNote ?? 'Initial draft',
              createdAt,
            },
            select: { id: true },
          });
          await transaction.newsArticle.update({
            where: { id: created.id },
            data: { draftRevisionId: revision.id },
            select: { id: true },
          });
          const contributor = await transaction.newsContributor.upsert({
            where: { userId: actor.id },
            create: {
              userId: actor.id,
              displayName: actor.name,
              slug: `staff-${actor.id.replaceAll('-', '')}`,
            },
            update: { displayName: actor.name },
            select: { id: true },
          });
          await transaction.newsArticleContributor.create({
            data: { articleId: created.id, contributorId: contributor.id, role: 'AUTHOR' },
            select: { articleId: true },
          });
          await transaction.newsArticleStatusHistory.create({
            data: {
              articleId: created.id,
              fromStatus: null,
              toStatus: NewsArticleStatus.DRAFT,
              actorId: actor.id,
              createdAt,
            },
            select: { id: true },
          });
          const article = await transaction.newsArticle.findUniqueOrThrow({
            where: { id: created.id },
            select: articleSelect,
          });
          return { article: redactArticleSources(serializeArticle(article), actor) };
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

  async detail(articleId: string, actor: StaffPrincipal) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { id: articleId },
      select: articleSelect,
    });
    if (!article) throw new NotFoundException('Article not found.');
    if (canViewConfidentialSourceDetails(actor)) {
      const confidentialSourceIds = article.sources
        .filter((source) => source.confidential)
        .map((source) => source.id);
      if (confidentialSourceIds.length > 0) {
        await this.prisma.newsArticleSourceAccessAudit.createMany({
          data: confidentialSourceIds.map((sourceId) => ({
            articleId,
            sourceId,
            staffId: actor.id,
            reason: 'Restricted newsroom article detail access',
          })),
        });
      }
    }
    return { article: redactArticleSources(serializeArticle(article), actor) };
  }

  async update(articleId: string, input: UpdateNewsArticleDto, actor: StaffPrincipal) {
    const category = await this.activeCategory(input.categoryCode);
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.newsArticle.findUnique({
        where: { id: articleId },
        select: { id: true, authorId: true, status: true, updatedAt: true },
      });
      if (!existing) throw new NotFoundException('Article not found.');
      assertCanEditDraft(existing.authorId, existing.status, actor);
      const expectedUpdatedAtValue = input.expectedUpdatedAt;
      const content = {
        titleHa: input.titleHa,
        summaryHa: input.summaryHa,
        bodyHa: input.bodyHa,
        titleEn: input.titleEn,
        summaryEn: input.summaryEn,
        bodyEn: input.bodyEn,
      };
      const revisionContent = {
        ...content,
        bodyBlocksHa: input.bodyBlocksHa,
        bodyBlocksEn: input.bodyBlocksEn,
      };
      const expectedUpdatedAt = new Date(expectedUpdatedAtValue);
      if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
      const updatedAt = nextTimestamp(existing.updatedAt, this.clock);
      const latestRevision = await transaction.newsArticleRevision.findFirst({
        where: { articleId },
        select: { revisionNumber: true },
        orderBy: { revisionNumber: 'desc' },
      });
      const revision = await transaction.newsArticleRevision.create({
        data: {
          articleId,
          revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
          ...revisionContent,
          createdById: actor.id,
          changeNote: input.changeNote ?? null,
          createdAt: updatedAt,
        },
        select: { id: true },
      });
      const result = await transaction.newsArticle.updateMany({
        where: {
          id: articleId,
          status: { in: [NewsArticleStatus.DRAFT, NewsArticleStatus.CHANGES_REQUESTED] },
          updatedAt: expectedUpdatedAt,
        },
        data: { ...content, categoryId: category.id, draftRevisionId: revision.id, updatedAt },
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
      return { article: redactArticleSources(serializeArticle(article), actor) };
    });
  }

  async transition(articleId: string, input: NewsArticleDecisionDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.newsArticle.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          authorId: true,
          assignedReviewerId: true,
          status: true,
          updatedAt: true,
          titleHa: true,
          summaryHa: true,
          bodyHa: true,
          titleEn: true,
          summaryEn: true,
          bodyEn: true,
          draftRevisionId: true,
          submittedRevisionId: true,
          submittedRevision: {
            select: {
              titleHa: true,
              summaryHa: true,
              bodyHa: true,
              titleEn: true,
              summaryEn: true,
              bodyEn: true,
            },
          },
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
        (input.decision === 'REQUEST_CHANGES' || input.decision === 'MARK_READY_TO_PUBLISH') &&
        !hasNewsroomCapability(actor.role, 'NEWS_EDIT_ANY') &&
        existing.assignedReviewerId !== actor.id
      ) {
        throw new ForbiddenException('Only the assigned reviewer may review this article.');
      }
      if (
        (input.decision === 'SUBMIT_FOR_REVIEW' || input.decision === 'PUBLISH') &&
        !existing.category.isActive
      ) {
        throw new ConflictException('The article category is unavailable.');
      }
      if (
        (input.decision === 'SUBMIT_FOR_REVIEW' || input.decision === 'PUBLISH') &&
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
      if (input.decision === 'SUBMIT_FOR_REVIEW' && !existing.draftRevisionId) {
        throw new ConflictException('The article has no draft revision to submit.');
      }
      if (
        input.decision === 'PUBLISH' &&
        !existing.submittedRevision &&
        !existing.draftRevisionId
      ) {
        throw new ConflictException('The article has no submitted revision to publish.');
      }
      const mutationData: Prisma.NewsArticleUncheckedUpdateManyInput =
        input.decision === 'SUBMIT_FOR_REVIEW'
          ? {
              status: targetStatus,
              updatedAt: changedAt,
              submittedForReviewAt: changedAt,
              submittedRevisionId: existing.draftRevisionId,
            }
          : input.decision === 'PUBLISH'
            ? {
                status: targetStatus,
                updatedAt: changedAt,
                publishedAt: changedAt,
                publicUpdatedAt: changedAt,
                publishedRevisionId: existing.submittedRevisionId ?? existing.draftRevisionId,
                ...(existing.submittedRevision ?? {
                  titleHa: existing.titleHa,
                  summaryHa: existing.summaryHa,
                  bodyHa: existing.bodyHa,
                  titleEn: existing.titleEn,
                  summaryEn: existing.summaryEn,
                  bodyEn: existing.bodyEn,
                }),
              }
            : input.decision === 'ARCHIVE'
              ? { status: targetStatus, updatedAt: changedAt, archivedAt: changedAt }
              : { status: targetStatus, updatedAt: changedAt };
      const result = await transaction.newsArticle.updateMany({
        where: { id: articleId, status: existing.status, updatedAt: expectedUpdatedAt },
        data: mutationData,
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

  async assign(articleId: string, input: NewsArticleAssignmentDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.newsArticle.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          updatedAt: true,
          assignedWriterId: true,
          assignedReviewerId: true,
          desk: true,
          dueAt: true,
          priority: true,
        },
      });
      if (!existing) throw new NotFoundException('Article not found.');
      const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
      if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
      if (
        input.assignedReviewerId === actor.id &&
        !hasNewsroomCapability(actor.role, 'NEWS_REVIEW')
      ) {
        throw new ForbiddenException('A writer cannot assign themselves as reviewer.');
      }

      const targetIds = [input.assignedWriterId, input.assignedReviewerId].filter(
        (id): id is string => Boolean(id),
      );
      if (targetIds.length > 0) {
        const eligible = await transaction.user.count({
          where: {
            id: { in: targetIds },
            status: UserStatus.ACTIVE,
            role: {
              in: [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR, StaffRole.EDITOR],
            },
          },
        });
        if (eligible !== new Set(targetIds).size) {
          throw new NotFoundException('An eligible newsroom assignee was not found.');
        }
      }

      const unchanged =
        existing.assignedWriterId === input.assignedWriterId &&
        existing.assignedReviewerId === input.assignedReviewerId &&
        existing.desk === input.desk &&
        existing.dueAt?.getTime() === (input.dueAt ? new Date(input.dueAt).getTime() : undefined) &&
        existing.priority === input.priority;
      if (unchanged) throw new ConflictException('The newsroom assignment has not changed.');

      const changedAt = nextTimestamp(existing.updatedAt, this.clock);
      const result = await transaction.newsArticle.updateMany({
        where: { id: articleId, updatedAt: expectedUpdatedAt },
        data: {
          assignedWriterId: input.assignedWriterId,
          assignedReviewerId: input.assignedReviewerId,
          desk: input.desk,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          priority: input.priority,
          updatedAt: changedAt,
        },
      });
      if (result.count !== 1) throw conflict();
      await transaction.newsArticleAssignmentHistory.create({
        data: {
          articleId,
          fromWriterId: existing.assignedWriterId,
          toWriterId: input.assignedWriterId,
          fromReviewerId: existing.assignedReviewerId,
          toReviewerId: input.assignedReviewerId,
          fromDesk: existing.desk,
          toDesk: input.desk,
          fromDueAt: existing.dueAt,
          toDueAt: input.dueAt ? new Date(input.dueAt) : null,
          fromPriority: existing.priority,
          toPriority: input.priority,
          changedById: actor.id,
          reason: input.reason ?? null,
          createdAt: changedAt,
        },
        select: { id: true },
      });
      const article = await transaction.newsArticle.findUniqueOrThrow({
        where: { id: articleId },
        select: articleSelect,
      });
      return { article: redactArticleSources(serializeArticle(article), actor) };
    });
  }

  async createContributor(input: ContributorCreateDto) {
    const contributor = await this.prisma.newsContributor.create({
      data: {
        displayName: input.displayName,
        slug: input.slug,
        bio: input.bio,
        userId: input.userId,
        publicStatus: input.publicStatus,
      },
      select: { id: true, displayName: true, slug: true, bio: true, publicStatus: true },
    });
    return { contributor };
  }

  async createTag(input: TagCreateDto) {
    return {
      tag: await this.prisma.newsTag.create({
        data: input,
        select: { id: true, slug: true, name: true },
      }),
    };
  }

  async createTopic(input: TopicCreateDto) {
    return {
      topic: await this.prisma.newsTopic.create({
        data: input,
        select: { id: true, slug: true, nameHa: true, nameEn: true },
      }),
    };
  }

  async contributors() {
    return {
      items: await this.prisma.newsContributor.findMany({
        select: {
          id: true,
          displayName: true,
          slug: true,
          bio: true,
          publicStatus: true,
          userId: true,
        },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        take: 500,
      }),
    };
  }

  async tags() {
    return {
      items: await this.prisma.newsTag.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, name: true, isActive: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 500,
      }),
    };
  }

  async topics() {
    return {
      items: await this.prisma.newsTopic.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, nameHa: true, nameEn: true, isActive: true },
        orderBy: [{ nameHa: 'asc' }, { id: 'asc' }],
        take: 500,
      }),
    };
  }

  async updateContributor(id: string, input: ContributorUpdateDto) {
    return {
      contributor: await this.prisma.newsContributor.update({
        where: { id },
        data: input,
        select: { id: true, displayName: true, slug: true, bio: true, publicStatus: true },
      }),
    };
  }

  async updateTag(id: string, input: TagUpdateDto) {
    return {
      tag: await this.prisma.newsTag.update({
        where: { id },
        data: input,
        select: { id: true, slug: true, name: true, isActive: true },
      }),
    };
  }

  async updateTopic(id: string, input: TopicUpdateDto) {
    return {
      topic: await this.prisma.newsTopic.update({
        where: { id },
        data: input,
        select: { id: true, slug: true, nameHa: true, nameEn: true, isActive: true },
      }),
    };
  }

  async updateMetadata(articleId: string, input: NewsArticleMetadataDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.newsArticle.findUnique({
        where: { id: articleId },
        select: { id: true, authorId: true, status: true, updatedAt: true },
      });
      if (!existing) throw new NotFoundException('Article not found.');
      assertCanEditDraft(existing.authorId, existing.status, actor);
      if (existing.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
        throw conflict();
      }
      if (
        input.sources.some((source) => source.confidential) &&
        !canViewConfidentialSourceDetails(actor)
      ) {
        throw new ForbiddenException(
          'Confidential source management requires senior newsroom capability.',
        );
      }

      const contributorIds = [...new Set(input.contributors.map((item) => item.contributorId))];
      const tagIds = [...new Set(input.tagIds)];
      const topicIds = [...new Set(input.topicIds)];
      const [contributors, tags, topics] = await Promise.all([
        transaction.newsContributor.count({ where: { id: { in: contributorIds } } }),
        transaction.newsTag.count({ where: { id: { in: tagIds } } }),
        transaction.newsTopic.count({ where: { id: { in: topicIds } } }),
      ]);
      if (
        contributors !== contributorIds.length ||
        tags !== tagIds.length ||
        topics !== topicIds.length
      ) {
        throw new NotFoundException('One or more metadata records were not found.');
      }
      await transaction.newsArticleContributor.deleteMany({ where: { articleId } });
      await transaction.newsArticleTag.deleteMany({ where: { articleId } });
      await transaction.newsArticleTopic.deleteMany({ where: { articleId } });
      await transaction.newsArticleLocation.deleteMany({ where: { articleId } });
      await transaction.newsArticleContributor.createMany({
        data: input.contributors.map((item) => ({ articleId, ...item })),
      });
      await transaction.newsArticleTag.createMany({
        data: tagIds.map((tagId) => ({ articleId, tagId })),
      });
      await transaction.newsArticleTopic.createMany({
        data: topicIds.map((topicId) => ({ articleId, topicId })),
      });
      await transaction.newsArticleLocation.createMany({
        data: input.locations.map((location) => ({ articleId, ...location })),
      });

      const sourceIds = input.sources.flatMap((source) => (source.id ? [source.id] : []));
      await transaction.newsArticleSource.deleteMany({
        where: { articleId, ...(sourceIds.length ? { id: { notIn: sourceIds } } : {}) },
      });
      for (const source of input.sources) {
        const data = {
          type: source.type,
          publicLabel: source.publicLabel,
          organization: source.organization,
          url: source.url,
          confidential: source.confidential,
          internalNotes: source.internalNotes,
          displayOrder: source.displayOrder,
        };
        if (source.id) {
          await transaction.newsArticleSource.updateMany({
            where: { id: source.id, articleId },
            data,
          });
        } else {
          await transaction.newsArticleSource.create({ data: { articleId, ...data } });
        }
      }
      const updatedAt = nextTimestamp(existing.updatedAt, this.clock);
      const updated = await transaction.newsArticle.updateMany({
        where: { id: articleId, updatedAt: existing.updatedAt },
        data: { updatedAt },
      });
      if (updated.count !== 1) throw conflict();
      const article = await transaction.newsArticle.findUniqueOrThrow({
        where: { id: articleId },
        select: articleSelect,
      });
      return { article: redactArticleSources(serializeArticle(article), actor) };
    });
  }

  async updateMedia(articleId: string, input: NewsArticleMediaDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.newsArticle.findUnique({
        where: { id: articleId },
        select: { id: true, authorId: true, status: true, updatedAt: true },
      });
      if (!existing) throw new NotFoundException('Article not found.');
      assertCanEditDraft(existing.authorId, existing.status, actor);
      if (existing.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
        throw conflict();
      const mediaIds = [
        ...new Set([
          ...(input.featuredMediaId ? [input.featuredMediaId] : []),
          ...(input.socialMediaId ? [input.socialMediaId] : []),
          ...input.galleryMediaIds,
          ...input.inlineMediaIds,
        ]),
      ];
      const available = await transaction.newsroomMedia.count({
        where: { id: { in: mediaIds }, status: 'ACTIVE', mediaType: 'IMAGE' },
      });
      if (available !== mediaIds.length) {
        throw new NotFoundException('One or more active newsroom images were not found.');
      }
      await transaction.newsArticleMedia.deleteMany({ where: { articleId } });
      await transaction.newsArticleMedia.createMany({
        data: [
          ...input.inlineMediaIds.map((mediaId, displayOrder) => ({
            articleId,
            mediaId,
            role: 'INLINE' as const,
            displayOrder,
          })),
          ...input.galleryMediaIds.map((mediaId, displayOrder) => ({
            articleId,
            mediaId,
            role: 'GALLERY' as const,
            displayOrder,
          })),
        ],
      });
      const updatedAt = nextTimestamp(existing.updatedAt, this.clock);
      const changed = await transaction.newsArticle.updateMany({
        where: { id: articleId, updatedAt: new Date(input.expectedUpdatedAt) },
        data: {
          featuredMediaId: input.featuredMediaId,
          socialMediaId: input.socialMediaId,
          updatedAt,
        },
      });
      if (changed.count !== 1) throw conflict();
      const article = await transaction.newsArticle.findUniqueOrThrow({
        where: { id: articleId },
        select: articleSelect,
      });
      return { article: redactArticleSources(serializeArticle(article), actor) };
    });
  }

  async updatePublishingMetadata(
    articleId: string,
    input: NewsArticlePublishingMetadataDto,
    actor: StaffPrincipal,
  ) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { id: articleId },
      select: { status: true, updatedAt: true },
    });
    if (!article) throw new NotFoundException('Article not found.');
    if (input.isBreaking && article.status !== NewsArticleStatus.PUBLISHED) {
      throw new ConflictException('Breaking can only be enabled on a published article.');
    }
    const updatedAt = nextTimestamp(article.updatedAt, this.clock);
    const changed = await this.prisma.newsArticle.updateMany({
      where: { id: articleId, updatedAt: new Date(input.expectedUpdatedAt) },
      data: { isFeatured: input.isFeatured, isBreaking: input.isBreaking, updatedAt },
    });
    if (changed.count !== 1) throw conflict();
    void actor;
    return {
      article: {
        id: articleId,
        isFeatured: input.isFeatured,
        isBreaking: input.isBreaking,
        updatedAt: updatedAt.toISOString(),
      },
    };
  }

  async addCorrection(articleId: string, input: NewsArticleCorrectionDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const article = await transaction.newsArticle.findUnique({
        where: { id: articleId },
        select: { status: true, updatedAt: true },
      });
      if (!article) throw new NotFoundException('Article not found.');
      if (article.status !== NewsArticleStatus.PUBLISHED) {
        throw new ConflictException('Corrections can only be recorded for published articles.');
      }
      if (article.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
        throw conflict();
      const createdAt = nextTimestamp(article.updatedAt, this.clock);
      const correction = await transaction.newsArticleCorrection.create({
        data: {
          articleId,
          noteHa: input.noteHa,
          noteEn: input.noteEn,
          createdById: actor.id,
          createdAt,
        },
        select: {
          id: true,
          noteHa: true,
          noteEn: true,
          createdAt: true,
          createdBy: { select: minimalActorSelect },
        },
      });
      const changed = await transaction.newsArticle.updateMany({
        where: { id: articleId, status: NewsArticleStatus.PUBLISHED, updatedAt: article.updatedAt },
        data: { updatedAt: createdAt, publicUpdatedAt: createdAt },
      });
      if (changed.count !== 1) throw conflict();
      return {
        correction: { ...correction, createdAt: correction.createdAt.toISOString() },
        article: {
          id: articleId,
          updatedAt: createdAt.toISOString(),
          publicUpdatedAt: createdAt.toISOString(),
        },
      };
    });
  }

  async eligibleAssignees() {
    const items = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: {
          in: [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR, StaffRole.EDITOR],
        },
      },
      select: { id: true, displayName: true, role: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return { items };
  }

  async dashboard(actor: StaffPrincipal) {
    const startOfToday = new Date(this.clock());
    startOfToday.setUTCHours(0, 0, 0, 0);
    const [
      myDrafts,
      waitingForReview,
      changesRequested,
      readyToPublish,
      publishedToday,
      assignedToMe,
    ] = await Promise.all([
      this.prisma.newsArticle.count({
        where: {
          authorId: actor.id,
          status: { in: [NewsArticleStatus.DRAFT, NewsArticleStatus.CHANGES_REQUESTED] },
        },
      }),
      this.prisma.newsArticle.count({ where: { status: NewsArticleStatus.IN_REVIEW } }),
      this.prisma.newsArticle.count({ where: { status: NewsArticleStatus.CHANGES_REQUESTED } }),
      this.prisma.newsArticle.count({ where: { status: NewsArticleStatus.READY_TO_PUBLISH } }),
      this.prisma.newsArticle.count({
        where: { status: NewsArticleStatus.PUBLISHED, publishedAt: { gte: startOfToday } },
      }),
      this.prisma.newsArticle.count({
        where: { OR: [{ assignedWriterId: actor.id }, { assignedReviewerId: actor.id }] },
      }),
    ]);
    return {
      generatedAt: new Date(this.clock()).toISOString(),
      myDrafts,
      assignedToMe,
      waitingForReview,
      changesRequested,
      readyToPublish,
      publishedToday,
    };
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
