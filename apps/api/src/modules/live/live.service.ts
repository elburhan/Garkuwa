import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { StaffPrincipal } from '../auth/auth.types.js';
import { createNewsSlugBase, newsSlugCandidate } from '../news/news-slug.js';
import type {
  CreateLiveEventDto,
  CreateLiveUpdateDto,
  LiveCorrectionDto,
  LiveEventPublishingDto,
  LivePinDto,
  ListLiveEventsQuery,
  LiveWithdrawalDto,
  UpdateLiveEventMetadataDto,
} from './dto/live.dto.js';

export const LIVE_CLOCK = Symbol('LIVE_CLOCK');
export type PublicLiveLanguage = 'ha' | 'en';
const INITIAL_UPDATE_LIMIT = 20;
const actorSelect = { id: true, displayName: true } as const;
const publicMediaSelect = {
  id: true,
  mimeType: true,
  width: true,
  height: true,
  altTextHa: true,
  altTextEn: true,
  captionHa: true,
  captionEn: true,
  credit: true,
  status: true,
} as const;
const eventSelect = {
  id: true,
  slug: true,
  titleHa: true,
  titleEn: true,
  summaryHa: true,
  summaryEn: true,
  status: true,
  isFeatured: true,
  startedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { code: true, slug: true, nameHa: true, nameEn: true } },
  featuredMediaId: true,
  createdBy: { select: actorSelect },
} as const;
const updateSelect = {
  id: true,
  sequence: true,
  headlineHa: true,
  headlineEn: true,
  bodyHa: true,
  bodyEn: true,
  isRetracted: true,
  isPinned: true,
  correctedAt: true,
  withdrawnAt: true,
  withdrawalReason: true,
  mediaId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: actorSelect },
  media: { select: publicMediaSelect },
  revisions: {
    select: {
      id: true,
      headlineHa: true,
      headlineEn: true,
      bodyHa: true,
      bodyEn: true,
      reason: true,
      createdAt: true,
      createdBy: { select: actorSelect },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.LiveUpdateSelect;

type LiveUpdateProjection = Prisma.LiveUpdateGetPayload<{ select: typeof updateSelect }>;
type PublicMediaProjection = {
  id: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altTextHa: string | null;
  altTextEn: string | null;
  captionHa: string | null;
  captionEn: string | null;
  credit: string | null;
  status: string;
};
type PublicEventProjection = {
  slug: string;
  titleHa: string;
  titleEn: string | null;
  summaryHa: string | null;
  summaryEn: string | null;
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT' | 'ARCHIVED';
  isFeatured: boolean;
  startedAt: Date | null;
  closedAt: Date | null;
  updatedAt: Date;
  category: { slug: string; nameHa: string; nameEn: string };
  featuredMedia: PublicMediaProjection | null;
  _count: { updates: number };
  updates: Array<{ updatedAt: Date }>;
};

const lifecycle = {
  START: { from: ['DRAFT'], to: 'ACTIVE', operation: 'STARTED' },
  CLOSE: { from: ['ACTIVE'], to: 'CLOSED', operation: 'ENDED' },
  REOPEN: { from: ['CLOSED'], to: 'ACTIVE', operation: 'REOPENED' },
  ARCHIVE: { from: ['ACTIVE', 'CLOSED'], to: 'ARCHIVED', operation: 'ARCHIVED' },
} as const;

function conflict() {
  return new ConflictException('The live coverage changed and must be refreshed.');
}
function nextTimestamp(current: Date, clock: () => number) {
  return new Date(Math.max(clock(), current.getTime() + 1));
}
function serializeEvent<
  Event extends { startedAt: Date | null; closedAt: Date | null; createdAt: Date; updatedAt: Date },
>(event: Event) {
  return {
    ...event,
    startedAt: event.startedAt?.toISOString() ?? null,
    closedAt: event.closedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
function serializeUpdate<
  Update extends {
    createdAt: Date;
    updatedAt: Date;
    correctedAt?: Date | null;
    withdrawnAt?: Date | null;
  },
>(update: Update) {
  return {
    ...update,
    createdAt: update.createdAt.toISOString(),
    updatedAt: update.updatedAt.toISOString(),
    ...(update.correctedAt !== undefined
      ? { correctedAt: update.correctedAt?.toISOString() ?? null }
      : {}),
    ...(update.withdrawnAt !== undefined
      ? { withdrawnAt: update.withdrawnAt?.toISOString() ?? null }
      : {}),
  };
}

@Injectable()
export class LiveService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LIVE_CLOCK) private readonly clock: () => number,
  ) {}

  async create(input: CreateLiveEventDto, actor: StaffPrincipal) {
    const category = await this.prisma.newsCategory.findFirst({
      where: { code: input.categoryCode, isActive: true },
      select: { id: true },
    });
    if (!category) throw new ConflictException('The live event category is unavailable.');
    const base = createNewsSlugBase(input.titleHa);
    for (let collision = 1; collision <= 100; collision += 1) {
      const slug = newsSlugCandidate(base, collision);
      if (await this.prisma.liveEvent.findUnique({ where: { slug }, select: { id: true } }))
        continue;
      const createdAt = new Date(this.clock());
      const created = await this.prisma.$transaction(async (tx) => {
        const event = await tx.liveEvent.create({
          data: {
            slug,
            titleHa: input.titleHa,
            titleEn: input.titleEn,
            summaryHa: input.summaryHa,
            summaryEn: input.summaryEn,
            categoryId: category.id,
            createdById: actor.id,
            status: 'DRAFT',
            startedAt: null,
            createdAt,
            updatedAt: createdAt,
          },
          select: eventSelect,
        });
        await tx.liveEventOperation.create({
          data: { eventId: event.id, action: 'CREATED', actorId: actor.id, createdAt },
        });
        return event;
      });
      return { event: serializeEvent(created) };
    }
    throw new ConflictException('A unique live event slug could not be allocated.');
  }

  async list(query: ListLiveEventsQuery) {
    const where = query.status ? { status: query.status } : {};
    const [items, totalItems] = await Promise.all([
      this.prisma.liveEvent.findMany({
        where,
        select: eventSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.liveEvent.count({ where }),
    ]);
    return {
      items: items.map(serializeEvent),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
      },
    };
  }

  async detail(eventId: string) {
    const event = await this.prisma.liveEvent.findUnique({
      where: { id: eventId },
      select: eventSelect,
    });
    if (!event) throw new NotFoundException('Live event not found.');
    const [updates, operations] = await Promise.all([
      this.prisma.liveUpdate.findMany({
        where: { liveEventId: eventId },
        select: updateSelect,
        orderBy: [{ sequence: 'desc' }],
      }),
      this.prisma.liveEventOperation.findMany({
        where: { eventId },
        select: { id: true, action: true, createdAt: true, actor: { select: actorSelect } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return {
      event: serializeEvent(event),
      updates: updates.map(serializeUpdate),
      operations: operations.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    };
  }

  async updateMetadata(eventId: string, input: UpdateLiveEventMetadataDto) {
    const existing = await this.prisma.liveEvent.findUnique({
      where: { id: eventId },
      select: { status: true, updatedAt: true },
    });
    if (!existing) throw new NotFoundException('Live event not found.');
    if (existing.status === 'ARCHIVED')
      throw new ConflictException('Archived live coverage cannot be edited.');
    if (existing.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
      throw conflict();
    const category = await this.prisma.newsCategory.findFirst({
      where: { code: input.categoryCode, isActive: true },
      select: { id: true },
    });
    if (!category) throw new ConflictException('The live event category is unavailable.');
    if (
      input.featuredMediaId &&
      !(await this.prisma.newsroomMedia.count({
        where: { id: input.featuredMediaId, status: 'ACTIVE', mediaType: 'IMAGE' },
      }))
    )
      throw new NotFoundException('The selected newsroom image was not found.');
    const updatedAt = nextTimestamp(existing.updatedAt, this.clock);
    const changed = await this.prisma.liveEvent.updateMany({
      where: { id: eventId, updatedAt: existing.updatedAt },
      data: {
        titleHa: input.titleHa,
        titleEn: input.titleEn,
        summaryHa: input.summaryHa,
        summaryEn: input.summaryEn,
        categoryId: category.id,
        featuredMediaId: input.featuredMediaId,
        updatedAt,
      },
    });
    if (changed.count !== 1) throw conflict();
    return {
      event: serializeEvent(
        await this.prisma.liveEvent.findUniqueOrThrow({
          where: { id: eventId },
          select: eventSelect,
        }),
      ),
    };
  }

  async updatePublishing(eventId: string, input: LiveEventPublishingDto, actor: StaffPrincipal) {
    const rule = lifecycle[input.action];
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.liveEvent.findUnique({
        where: { id: eventId },
        select: { status: true, updatedAt: true },
      });
      if (!existing) throw new NotFoundException('Live event not found.');
      if (existing.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
        throw conflict();
      if (!(rule.from as readonly string[]).includes(existing.status))
        throw new BadRequestException(
          'That live lifecycle action is not allowed from the current status.',
        );
      const updatedAt = nextTimestamp(existing.updatedAt, this.clock);
      const changed = await tx.liveEvent.updateMany({
        where: { id: eventId, updatedAt: existing.updatedAt, status: existing.status },
        data: {
          status: rule.to,
          isFeatured: input.isFeatured,
          updatedAt,
          ...(input.action === 'CLOSE' ? { closedAt: updatedAt } : {}),
          ...(input.action === 'START' ? { startedAt: updatedAt, closedAt: null } : {}),
          ...(input.action === 'REOPEN' ? { closedAt: null } : {}),
        },
      });
      if (changed.count !== 1) throw conflict();
      await tx.liveEventOperation.create({
        data: { eventId, action: rule.operation, actorId: actor.id, createdAt: updatedAt },
      });
      return {
        event: serializeEvent(
          await tx.liveEvent.findUniqueOrThrow({ where: { id: eventId }, select: eventSelect }),
        ),
      };
    });
  }

  async addUpdate(eventId: string, input: CreateLiveUpdateDto, actor: StaffPrincipal) {
    const duplicate = await this.prisma.liveUpdate.findUnique({
      where: {
        liveEventId_clientSubmissionId: {
          liveEventId: eventId,
          clientSubmissionId: input.clientSubmissionId,
        },
      },
      select: updateSelect,
    });
    if (duplicate) return { update: serializeUpdate(duplicate) };
    if (
      input.mediaId &&
      !(await this.prisma.newsroomMedia.count({
        where: { id: input.mediaId, status: 'ACTIVE', mediaType: 'IMAGE' },
      }))
    )
      throw new NotFoundException('The selected newsroom image was not found.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdAt = new Date(this.clock());
        const rows = await tx.$queryRaw<Array<{ next_sequence: number }>>(Prisma.sql`
          UPDATE "live_events" SET "next_sequence" = "next_sequence" + 1, "updated_at" = ${createdAt}
          WHERE "id" = ${eventId}::uuid AND "status" = 'ACTIVE'
          RETURNING "next_sequence"
        `);
        if (!rows[0])
          throw new ConflictException('Updates can only be posted to active live coverage.');
        const created = await tx.liveUpdate.create({
          data: {
            liveEventId: eventId,
            sequence: rows[0].next_sequence,
            headlineHa: input.headlineHa,
            headlineEn: input.headlineEn,
            bodyHa: input.bodyHa,
            bodyEn: input.bodyEn,
            mediaId: input.mediaId,
            clientSubmissionId: input.clientSubmissionId,
            createdById: actor.id,
            createdAt,
            updatedAt: createdAt,
          },
          select: updateSelect,
        });
        return { update: serializeUpdate(created) };
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      const existing = await this.prisma.liveUpdate.findUnique({
        where: {
          liveEventId_clientSubmissionId: {
            liveEventId: eventId,
            clientSubmissionId: input.clientSubmissionId,
          },
        },
        select: updateSelect,
      });
      if (existing) return { update: serializeUpdate(existing) };
      throw error;
    }
  }

  async pinUpdate(eventId: string, updateId: string, input: LivePinDto) {
    return this.changeUpdate(eventId, updateId, input.expectedUpdatedAt, {
      isPinned: input.isPinned,
    });
  }

  async correctUpdate(
    eventId: string,
    updateId: string,
    input: LiveCorrectionDto,
    actor: StaffPrincipal,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.liveUpdate.findUnique({
        where: { id: updateId },
        select: {
          liveEventId: true,
          headlineHa: true,
          headlineEn: true,
          bodyHa: true,
          bodyEn: true,
          withdrawnAt: true,
          updatedAt: true,
        },
      });
      if (!existing || existing.liveEventId !== eventId)
        throw new NotFoundException('Live update not found.');
      if (existing.withdrawnAt)
        throw new ConflictException('A withdrawn update cannot be corrected.');
      if (existing.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
        throw conflict();
      const correctedAt = nextTimestamp(existing.updatedAt, this.clock);
      await tx.liveUpdateRevision.create({
        data: {
          liveUpdateId: updateId,
          headlineHa: existing.headlineHa,
          headlineEn: existing.headlineEn,
          bodyHa: existing.bodyHa,
          bodyEn: existing.bodyEn,
          reason: input.reason,
          createdById: actor.id,
          createdAt: correctedAt,
        },
      });
      const changed = await tx.liveUpdate.updateMany({
        where: { id: updateId, liveEventId: eventId, updatedAt: existing.updatedAt },
        data: {
          headlineHa: input.headlineHa,
          headlineEn: input.headlineEn,
          bodyHa: input.bodyHa,
          bodyEn: input.bodyEn,
          correctedAt,
          updatedAt: correctedAt,
        },
      });
      if (changed.count !== 1) throw conflict();
      await tx.liveEvent.update({ where: { id: eventId }, data: { updatedAt: correctedAt } });
      return {
        update: serializeUpdate(
          await tx.liveUpdate.findUniqueOrThrow({ where: { id: updateId }, select: updateSelect }),
        ),
      };
    });
  }

  async withdrawUpdate(
    eventId: string,
    updateId: string,
    input: LiveWithdrawalDto,
    actor: StaffPrincipal,
  ) {
    const existing = await this.prisma.liveUpdate.findUnique({
      where: { id: updateId },
      select: { liveEventId: true, withdrawnAt: true, updatedAt: true },
    });
    if (!existing || existing.liveEventId !== eventId)
      throw new NotFoundException('Live update not found.');
    if (existing.withdrawnAt) throw new ConflictException('The live update is already withdrawn.');
    if (existing.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
      throw conflict();
    const withdrawnAt = nextTimestamp(existing.updatedAt, this.clock);
    return this.changeUpdate(eventId, updateId, input.expectedUpdatedAt, {
      isRetracted: true,
      isPinned: false,
      withdrawnAt,
      withdrawnById: actor.id,
      withdrawalReason: input.reason,
      updatedAt: withdrawnAt,
    });
  }

  private async changeUpdate(
    eventId: string,
    updateId: string,
    expectedUpdatedAt: string,
    data: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.liveUpdate.findUnique({
        where: { id: updateId },
        select: { liveEventId: true, updatedAt: true },
      });
      if (!existing || existing.liveEventId !== eventId)
        throw new NotFoundException('Live update not found.');
      if (existing.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw conflict();
      const updatedAt =
        'updatedAt' in data
          ? (data.updatedAt as Date)
          : nextTimestamp(existing.updatedAt, this.clock);
      const changed = await tx.liveUpdate.updateMany({
        where: { id: updateId, liveEventId: eventId, updatedAt: existing.updatedAt },
        data: { ...data, updatedAt },
      });
      if (changed.count !== 1) throw conflict();
      await tx.liveEvent.update({ where: { id: eventId }, data: { updatedAt } });
      return {
        update: serializeUpdate(
          await tx.liveUpdate.findUniqueOrThrow({
            where: { id: updateId },
            select: updateSelect,
          }),
        ),
      };
    });
  }

  async publicList(query: { page: number; pageSize: number; lang: PublicLiveLanguage }) {
    const where = {
      status: { in: ['ACTIVE' as const, 'CLOSED' as const] },
      ...(query.lang === 'en' ? { titleEn: { not: null } } : {}),
    };
    const select = {
      slug: true,
      titleHa: true,
      titleEn: true,
      summaryHa: true,
      summaryEn: true,
      status: true,
      isFeatured: true,
      startedAt: true,
      closedAt: true,
      updatedAt: true,
      category: { select: { slug: true, nameHa: true, nameEn: true } },
      featuredMedia: { select: publicMediaSelect },
      _count: {
        select: {
          updates: {
            where:
              query.lang === 'en'
                ? { OR: [{ bodyEn: { not: null } }, { withdrawnAt: { not: null } }] }
                : {},
          },
        },
      },
      updates: {
        where:
          query.lang === 'en'
            ? { OR: [{ bodyEn: { not: null } }, { withdrawnAt: { not: null } }] }
            : {},
        select: { updatedAt: true },
        orderBy: [{ updatedAt: 'desc' as const }, { id: 'desc' as const }],
        take: 1,
      },
    } satisfies Prisma.LiveEventSelect;
    const [items, totalItems] = await Promise.all([
      this.prisma.liveEvent.findMany({
        where,
        select,
        orderBy: [{ isFeatured: 'desc' }, { status: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.liveEvent.count({ where }),
    ]);
    return {
      generatedAt: new Date(this.clock()).toISOString(),
      items: items.map((item) => this.projectPublicListItem(item, query.lang)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
      },
    };
  }

  async publicDetail(
    slug: string,
    language: PublicLiveLanguage,
    beforeSequence?: number,
    limit = INITIAL_UPDATE_LIMIT,
  ) {
    const event = await this.publicEvent(slug, language);
    const updateWhere = {
      liveEventId: event.id,
      ...(beforeSequence ? { sequence: { lt: beforeSequence } } : {}),
      ...(language === 'en'
        ? { OR: [{ bodyEn: { not: null } }, { withdrawnAt: { not: null } }] }
        : {}),
    };
    const updates = await this.prisma.liveUpdate.findMany({
      where: updateWhere,
      select: updateSelect,
      orderBy: { sequence: 'desc' },
      take: limit + 1,
    });
    const page = updates.slice(0, limit);
    return {
      ...this.projectPublicListItem(event, language),
      updates: page.map((item) => this.projectPublicUpdate(item, language)),
      latestSequence: event.nextSequence,
      oldestSequence: page.at(-1)?.sequence ?? null,
      hasOlder: updates.length > limit,
    };
  }

  async publicUpdates(
    slug: string,
    language: PublicLiveLanguage,
    afterSequence: number,
    limit: number,
    changedAfter?: string,
  ) {
    const event = await this.publicEvent(slug, language);
    const where = {
      liveEventId: event.id,
      AND: [
        {
          OR: [
            { sequence: { gt: afterSequence } },
            ...(changedAfter ? [{ updatedAt: { gt: new Date(changedAfter) } }] : []),
          ],
        },
        ...(language === 'en'
          ? [{ OR: [{ bodyEn: { not: null } }, { withdrawnAt: { not: null } }] }]
          : []),
      ],
    };
    const rows = await this.prisma.liveUpdate.findMany({
      where,
      select: updateSelect,
      orderBy: { sequence: 'asc' },
      take: limit + 1,
    });
    return {
      generatedAt: new Date(this.clock()).toISOString(),
      updates: rows.slice(0, limit).map((item) => this.projectPublicUpdate(item, language)),
      latestSequence: event.nextSequence,
      hasMore: rows.length > limit,
    };
  }

  private async publicEvent(slug: string, language: PublicLiveLanguage) {
    const event = await this.prisma.liveEvent.findFirst({
      where: {
        slug,
        status: { in: ['ACTIVE', 'CLOSED'] },
        ...(language === 'en' ? { titleEn: { not: null } } : {}),
      },
      select: {
        id: true,
        slug: true,
        titleHa: true,
        titleEn: true,
        summaryHa: true,
        summaryEn: true,
        status: true,
        isFeatured: true,
        startedAt: true,
        closedAt: true,
        updatedAt: true,
        nextSequence: true,
        category: { select: { slug: true, nameHa: true, nameEn: true } },
        featuredMedia: { select: publicMediaSelect },
        _count: {
          select: {
            updates: {
              where:
                language === 'en'
                  ? { OR: [{ bodyEn: { not: null } }, { withdrawnAt: { not: null } }] }
                  : {},
            },
          },
        },
        updates: {
          where:
            language === 'en'
              ? { OR: [{ bodyEn: { not: null } }, { withdrawnAt: { not: null } }] }
              : {},
          select: { updatedAt: true },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
    });
    if (!event) throw new NotFoundException('Live event not found.');
    return event;
  }

  private projectPublicListItem(item: PublicEventProjection, language: PublicLiveLanguage) {
    return {
      slug: item.slug,
      title: language === 'en' ? item.titleEn : item.titleHa,
      summary: language === 'en' ? item.summaryEn : item.summaryHa,
      status: item.status,
      isFeatured: item.isFeatured,
      hasEnglishTranslation: Boolean(item.titleEn),
      startedAt: item.startedAt?.toISOString() ?? item.updatedAt.toISOString(),
      closedAt: item.closedAt?.toISOString() ?? null,
      updatedAt: (item.updates[0]?.updatedAt ?? item.startedAt ?? item.updatedAt).toISOString(),
      latestUpdateAt: item.updates[0]?.updatedAt.toISOString() ?? null,
      updateCount: item._count.updates,
      category: {
        slug: item.category.slug,
        name: language === 'en' ? item.category.nameEn : item.category.nameHa,
      },
      featuredMedia: this.projectMedia(item.featuredMedia, language),
    };
  }

  private projectPublicUpdate(item: LiveUpdateProjection, language: PublicLiveLanguage) {
    const withdrawn = Boolean(item.withdrawnAt);
    return {
      id: item.id,
      sequence: item.sequence,
      headline: withdrawn ? null : language === 'en' ? item.headlineEn : item.headlineHa,
      body: withdrawn ? null : language === 'en' ? item.bodyEn : item.bodyHa,
      isPinned: item.isPinned,
      isWithdrawn: withdrawn,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      correctedAt: item.correctedAt?.toISOString() ?? null,
      media: withdrawn ? null : this.projectMedia(item.media, language),
    };
  }

  private projectMedia(media: PublicMediaProjection | null, language: PublicLiveLanguage) {
    if (!media || media.status !== 'ACTIVE' || !media.width || !media.height) return null;
    const altText = language === 'en' ? media.altTextEn : media.altTextHa;
    if (!altText) return null;
    return {
      id: media.id,
      url: `/api/public/news/media/${media.id}`,
      mimeType: media.mimeType,
      width: media.width,
      height: media.height,
      altText,
      caption: language === 'en' ? media.captionEn : media.captionHa,
      credit: media.credit,
    };
  }
}
