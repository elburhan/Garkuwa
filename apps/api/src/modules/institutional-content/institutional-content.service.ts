import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import {
  InstitutionalPageKey,
  InstitutionalPageWorkflowStatus,
  StaffRole,
} from '../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../auth/auth.types.js';
import type {
  InstitutionalPageDecisionDto,
  PublicInstitutionalPageQuery,
  SaveInstitutionalDraftDto,
} from './dto/institutional-content.dto.js';
import { assertInstitutionalDecisionAllowed } from './institutional-content-policy.js';

export const INSTITUTIONAL_CONTENT_CLOCK = Symbol('INSTITUTIONAL_CONTENT_CLOCK');
const actorSelect = { id: true, displayName: true } as const;
const revisionSelect = {
  id: true,
  version: true,
  titleHa: true,
  summaryHa: true,
  titleEn: true,
  summaryEn: true,
  sectionsJson: true,
  createdAt: true,
  createdBy: { select: actorSelect },
} as const;
const routeMap: Record<InstitutionalPageKey, { ha: string; en: string }> = {
  ABOUT: { ha: '/about', en: '/en/about' },
  FAQ: { ha: '/faq', en: '/en/faq' },
  HELP: { ha: '/help', en: '/en/help' },
  CONTACT: { ha: '/contact', en: '/en/contact' },
  SAFETY_GUIDANCE: { ha: '/safety', en: '/en/safety' },
};
const fixedOrder = [
  InstitutionalPageKey.ABOUT,
  InstitutionalPageKey.FAQ,
  InstitutionalPageKey.HELP,
  InstitutionalPageKey.CONTACT,
  InstitutionalPageKey.SAFETY_GUIDANCE,
] as const;

export interface StoredSection {
  sectionKey: string;
  headingHa: string;
  bodyHa: string;
  headingEn: string | null;
  bodyEn: string | null;
}

function changedAt(current: Date, clock: () => number): Date {
  return new Date(Math.max(clock(), current.getTime() + 1));
}

function conflict(): ConflictException {
  return new ConflictException('The page changed and must be refreshed.');
}

function isEnglishComplete(revision: {
  titleEn: string | null;
  summaryHa: string | null;
  summaryEn: string | null;
  sectionsJson: unknown;
}): boolean {
  const sections = revision.sectionsJson as StoredSection[];
  return Boolean(
    revision.titleEn &&
    (!revision.summaryHa || revision.summaryEn) &&
    sections.every((section) => section.headingEn && section.bodyEn),
  );
}

interface RevisionRecord {
  id: string;
  version: number;
  titleHa: string;
  summaryHa: string | null;
  titleEn: string | null;
  summaryEn: string | null;
  sectionsJson: unknown;
  createdAt: Date;
  createdBy: { id: string; displayName: string } | null;
}

function serializeRevision(revision: RevisionRecord) {
  return {
    ...revision,
    sections: revision.sectionsJson as StoredSection[],
    sectionsJson: undefined,
    createdAt: revision.createdAt.toISOString(),
    englishComplete: isEnglishComplete(revision),
  };
}

@Injectable()
export class InstitutionalContentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(INSTITUTIONAL_CONTENT_CLOCK) private readonly clock: () => number,
  ) {}

  async list() {
    const pages = await this.prisma.institutionalPage.findMany({
      select: {
        key: true,
        workflowStatus: true,
        updatedAt: true,
        publishedAt: true,
        draftRevision: { select: { version: true } },
        publishedRevision: { select: { version: true } },
      },
    });
    const byKey = new Map(pages.map((page) => [page.key, page]));
    return {
      items: fixedOrder.flatMap((key) => {
        const page = byKey.get(key);
        return page
          ? [
              {
                pageKey: page.key,
                routes: routeMap[page.key],
                workflowStatus: page.workflowStatus,
                draftVersion: page.draftRevision?.version ?? null,
                publishedVersion: page.publishedRevision?.version ?? null,
                updatedAt: page.updatedAt.toISOString(),
                publishedAt: page.publishedAt?.toISOString() ?? null,
              },
            ]
          : [];
      }),
    };
  }

  async detail(pageKey: InstitutionalPageKey, actor: StaffPrincipal) {
    const page = await this.prisma.institutionalPage.findUnique({
      where: { key: pageKey },
      select: {
        key: true,
        workflowStatus: true,
        updatedAt: true,
        publishedAt: true,
        draftRevision: { select: revisionSelect },
        publishedRevision: { select: revisionSelect },
      },
    });
    if (!page) throw new NotFoundException('Institutional page not found.');
    const administrator = actor.role === StaffRole.SUPER_ADMIN || actor.role === StaffRole.ADMIN;
    return {
      page: {
        pageKey: page.key,
        routes: routeMap[page.key],
        workflowStatus: page.workflowStatus,
        updatedAt: page.updatedAt.toISOString(),
        publishedAt: page.publishedAt?.toISOString() ?? null,
        draftRevision: page.draftRevision ? serializeRevision(page.draftRevision) : null,
        publishedRevision: page.publishedRevision
          ? serializeRevision(page.publishedRevision)
          : null,
        allowedActions: {
          saveDraft:
            page.workflowStatus !== InstitutionalPageWorkflowStatus.IN_REVIEW &&
            (administrator || actor.role === StaffRole.EDITOR),
          submit:
            page.workflowStatus === InstitutionalPageWorkflowStatus.DRAFT &&
            (administrator || actor.role === StaffRole.EDITOR),
          return:
            page.workflowStatus === InstitutionalPageWorkflowStatus.IN_REVIEW &&
            (administrator || actor.role === StaffRole.MODERATOR),
          publish:
            page.workflowStatus === InstitutionalPageWorkflowStatus.IN_REVIEW && administrator,
        },
      },
    };
  }

  async saveDraft(
    pageKey: InstitutionalPageKey,
    input: SaveInstitutionalDraftDto,
    actor: StaffPrincipal,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const page = await transaction.institutionalPage.findUnique({
          where: { key: pageKey },
          select: { id: true, workflowStatus: true, updatedAt: true },
        });
        if (!page) throw new NotFoundException('Institutional page not found.');
        if (page.workflowStatus === InstitutionalPageWorkflowStatus.IN_REVIEW) {
          throw new ConflictException('A page in review must be returned before editing.');
        }
        const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
        if (page.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
        const latest = await transaction.institutionalPageRevision.aggregate({
          where: { pageId: page.id },
          _max: { version: true },
        });
        const now = changedAt(page.updatedAt, this.clock);
        const revision = await transaction.institutionalPageRevision.create({
          data: {
            pageId: page.id,
            version: (latest._max.version ?? 0) + 1,
            titleHa: input.titleHa,
            summaryHa: input.summaryHa,
            titleEn: input.titleEn,
            summaryEn: input.summaryEn,
            sectionsJson: input.sections,
            createdById: actor.id,
            createdAt: now,
          },
          select: revisionSelect,
        });
        const result = await transaction.institutionalPage.updateMany({
          where: {
            id: page.id,
            workflowStatus: page.workflowStatus,
            updatedAt: expectedUpdatedAt,
          },
          data: {
            draftRevisionId: revision.id,
            workflowStatus: InstitutionalPageWorkflowStatus.DRAFT,
            updatedAt: now,
          },
        });
        if (result.count !== 1) throw conflict();
        if (page.workflowStatus === InstitutionalPageWorkflowStatus.PUBLISHED) {
          await transaction.institutionalPageWorkflowHistory.create({
            data: {
              pageId: page.id,
              revisionId: revision.id,
              fromStatus: InstitutionalPageWorkflowStatus.PUBLISHED,
              toStatus: InstitutionalPageWorkflowStatus.DRAFT,
              actorId: actor.id,
              createdAt: now,
            },
            select: { id: true },
          });
        }
        return {
          revision: serializeRevision(revision),
          page: {
            pageKey,
            workflowStatus: InstitutionalPageWorkflowStatus.DRAFT,
            updatedAt: now.toISOString(),
          },
        };
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')
        throw conflict();
      throw error;
    }
  }

  async transition(
    pageKey: InstitutionalPageKey,
    input: InstitutionalPageDecisionDto,
    actor: StaffPrincipal,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const page = await transaction.institutionalPage.findUnique({
        where: { key: pageKey },
        select: {
          id: true,
          workflowStatus: true,
          updatedAt: true,
          draftRevisionId: true,
        },
      });
      if (!page) throw new NotFoundException('Institutional page not found.');
      if (!page.draftRevisionId) {
        throw new ConflictException('No draft revision is available for this action.');
      }
      const target = assertInstitutionalDecisionAllowed(page.workflowStatus, input.decision, actor);
      const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
      if (page.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
      const now = changedAt(page.updatedAt, this.clock);
      const result = await transaction.institutionalPage.updateMany({
        where: {
          id: page.id,
          workflowStatus: page.workflowStatus,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          workflowStatus: target,
          updatedAt: now,
          ...(input.decision === 'PUBLISH'
            ? {
                publishedRevisionId: page.draftRevisionId,
                draftRevisionId: null,
                publishedAt: now,
              }
            : {}),
        },
      });
      if (result.count !== 1) throw conflict();
      const history = await transaction.institutionalPageWorkflowHistory.create({
        data: {
          pageId: page.id,
          revisionId: page.draftRevisionId,
          fromStatus: page.workflowStatus,
          toStatus: target,
          actorId: actor.id,
          reason: input.reason ?? null,
          createdAt: now,
        },
        select: {
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
          actor: { select: actorSelect },
        },
      });
      return {
        page: { pageKey, workflowStatus: target, updatedAt: now.toISOString() },
        historyEntry: { ...history, createdAt: history.createdAt.toISOString() },
      };
    });
  }

  async revisions(pageKey: InstitutionalPageKey) {
    const page = await this.prisma.institutionalPage.findUnique({
      where: { key: pageKey },
      select: {
        id: true,
        draftRevisionId: true,
        publishedRevisionId: true,
        revisions: {
          select: revisionSelect,
          orderBy: [{ version: 'desc' }, { id: 'desc' }],
        },
      },
    });
    if (!page) throw new NotFoundException('Institutional page not found.');
    return {
      items: page.revisions.map((revision) => ({
        ...serializeRevision(revision),
        isDraft: revision.id === page.draftRevisionId,
        isPublished: revision.id === page.publishedRevisionId,
      })),
    };
  }

  async history(pageKey: InstitutionalPageKey) {
    const page = await this.prisma.institutionalPage.findUnique({
      where: { key: pageKey },
      select: { id: true },
    });
    if (!page) throw new NotFoundException('Institutional page not found.');
    const items = await this.prisma.institutionalPageWorkflowHistory.findMany({
      where: { pageId: page.id },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        createdAt: true,
        revision: { select: { version: true } },
        actor: { select: actorSelect },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return {
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async publicPage(pageKey: InstitutionalPageKey, query: PublicInstitutionalPageQuery) {
    const page = await this.prisma.institutionalPage.findUnique({
      where: { key: pageKey },
      select: {
        key: true,
        publishedAt: true,
        publishedRevision: {
          select: {
            titleHa: true,
            summaryHa: true,
            titleEn: true,
            summaryEn: true,
            sectionsJson: true,
          },
        },
      },
    });
    if (!page?.publishedRevision || !page.publishedAt) {
      throw new NotFoundException('Institutional page not found.');
    }
    const revision = page.publishedRevision;
    const sections = revision.sectionsJson as unknown as StoredSection[];
    const englishComplete = isEnglishComplete(revision);
    if (query.lang === 'en' && !englishComplete) {
      throw new NotFoundException('English institutional page not found.');
    }
    return {
      key: page.key,
      title: query.lang === 'ha' ? revision.titleHa : revision.titleEn!,
      summary: query.lang === 'ha' ? revision.summaryHa : revision.summaryEn,
      sections: sections.map((section) => ({
        sectionKey: section.sectionKey,
        heading: query.lang === 'ha' ? section.headingHa : section.headingEn!,
        body: query.lang === 'ha' ? section.bodyHa : section.bodyEn!,
      })),
      publishedAt: page.publishedAt.toISOString(),
      hasEnglishTranslation: englishComplete,
    };
  }
}
