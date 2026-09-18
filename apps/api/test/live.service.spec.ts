import { BadRequestException, ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';

import { LiveService } from '../src/modules/live/live.service.js';

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'editor@example.test',
  name: 'Test Editor',
  role: 'EDITOR',
} as const;
const eventId = '22222222-2222-4222-8222-222222222222';
const updateId = '33333333-3333-4333-8333-333333333333';
const submissionId = '44444444-4444-4444-8444-444444444444';
const timestamp = new Date('2026-09-17T10:00:00.000Z');
const resolved = <T>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value);

function eventProjection(overrides: Record<string, unknown> = {}) {
  return {
    id: eventId,
    slug: 'gwajin-lamari',
    titleHa: 'Gwajin lamari',
    titleEn: null,
    summaryHa: null,
    summaryEn: null,
    status: 'DRAFT',
    isFeatured: false,
    startedAt: null,
    closedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    category: { slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
    featuredMediaId: null,
    createdBy: { id: actor.id, displayName: actor.name },
    ...overrides,
  };
}

function updateProjection(overrides: Record<string, unknown> = {}) {
  return {
    id: updateId,
    sequence: 1,
    headlineHa: null,
    headlineEn: null,
    bodyHa: 'Sabuntawa',
    bodyEn: null,
    isRetracted: false,
    isPinned: false,
    correctedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    mediaId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: { id: actor.id, displayName: actor.name },
    media: null,
    revisions: [],
    ...overrides,
  };
}

describe('LiveService', () => {
  it('creates a draft and immutable creation operation', async () => {
    const tx = {
      liveEvent: { create: resolved(eventProjection()) },
      liveEventOperation: { create: resolved({}) },
    };
    const prisma = {
      newsCategory: { findFirst: resolved({ id: 'category' }) },
      liveEvent: { findUnique: resolved(null) },
      $transaction: (operation: (client: typeof tx) => unknown) => operation(tx),
    };
    const service = new LiveService(prisma as never, () => timestamp.getTime());
    const result = await service.create(
      {
        categoryCode: 'NEWS',
        titleHa: 'Gwajin lamari',
        titleEn: null,
        summaryHa: null,
        summaryEn: null,
      },
      actor as never,
    );
    expect(result.event.status).toBe('DRAFT');
    expect(tx.liveEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT', startedAt: null }),
      }),
    );
    expect(tx.liveEventOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'CREATED' }) }),
    );
  });

  it('starts coverage only through the lifecycle policy', async () => {
    const tx = {
      liveEvent: {
        findUnique: resolved({ status: 'DRAFT', updatedAt: timestamp }),
        updateMany: resolved({ count: 1 }),
        findUniqueOrThrow: resolved(eventProjection({ status: 'ACTIVE', startedAt: timestamp })),
      },
      liveEventOperation: { create: resolved({}) },
    };
    const service = new LiveService(
      { $transaction: (operation: (client: typeof tx) => unknown) => operation(tx) } as never,
      () => timestamp.getTime() + 1,
    );
    await service.updatePublishing(
      eventId,
      { action: 'START', isFeatured: false, expectedUpdatedAt: timestamp.toISOString() },
      actor as never,
    );
    expect(tx.liveEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', startedAt: expect.any(Date) }),
      }),
    );
  });

  it('rejects an invalid lifecycle transition', async () => {
    const tx = {
      liveEvent: {
        findUnique: resolved({ status: 'DRAFT', updatedAt: timestamp }),
      },
    };
    const service = new LiveService(
      { $transaction: (operation: (client: typeof tx) => unknown) => operation(tx) } as never,
      () => timestamp.getTime() + 1,
    );
    await expect(
      service.updatePublishing(
        eventId,
        { action: 'CLOSE', isFeatured: false, expectedUpdatedAt: timestamp.toISOString() },
        actor as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allocates update sequence atomically and accepts an idempotency token', async () => {
    const tx = {
      $queryRaw: resolved([{ next_sequence: 7 }]),
      liveUpdate: { create: resolved(updateProjection({ sequence: 7 })) },
    };
    const prisma = {
      liveUpdate: { findUnique: resolved(null) },
      newsroomMedia: { count: resolved(0) },
      $transaction: (operation: (client: typeof tx) => unknown) => operation(tx),
    };
    const service = new LiveService(prisma as never, () => timestamp.getTime());
    const result = await service.addUpdate(
      eventId,
      { bodyHa: 'Sabuntawa', clientSubmissionId: submissionId },
      actor as never,
    );
    expect(result.update.sequence).toBe(7);
    expect(tx.liveUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sequence: 7, clientSubmissionId: submissionId }),
      }),
    );
  });

  it('returns the existing update for a repeated submission token', async () => {
    const service = new LiveService(
      { liveUpdate: { findUnique: resolved(updateProjection()) } } as never,
      () => timestamp.getTime(),
    );
    const result = await service.addUpdate(
      eventId,
      { bodyHa: 'Sabuntawa', clientSubmissionId: submissionId },
      actor as never,
    );
    expect(result.update.id).toBe(updateId);
  });

  it('preserves old content in immutable correction history', async () => {
    const tx = {
      liveUpdate: {
        findUnique: resolved({
          liveEventId: eventId,
          headlineHa: null,
          headlineEn: null,
          bodyHa: 'Tsohon bayani',
          bodyEn: null,
          withdrawnAt: null,
          updatedAt: timestamp,
        }),
        updateMany: resolved({ count: 1 }),
        findUniqueOrThrow: resolved(updateProjection({ bodyHa: 'Sabon bayani' })),
      },
      liveUpdateRevision: { create: resolved({}) },
      liveEvent: { update: resolved({}) },
    };
    const service = new LiveService(
      { $transaction: (operation: (client: typeof tx) => unknown) => operation(tx) } as never,
      () => timestamp.getTime() + 1,
    );
    await service.correctUpdate(
      eventId,
      updateId,
      {
        bodyHa: 'Sabon bayani',
        reason: 'An gyara kuskuren bayani.',
        expectedUpdatedAt: timestamp.toISOString(),
      },
      actor as never,
    );
    expect(tx.liveUpdateRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bodyHa: 'Tsohon bayani' }) }),
    );
  });

  it('returns a conflict for a stale update mutation', async () => {
    const tx = {
      liveUpdate: {
        findUnique: resolved({ liveEventId: eventId, updatedAt: timestamp }),
      },
    };
    const service = new LiveService(
      {
        $transaction: (operation: (client: typeof tx) => unknown) => operation(tx),
      } as never,
      () => timestamp.getTime() + 1,
    );
    await expect(
      service.pinUpdate(eventId, updateId, {
        isPinned: true,
        expectedUpdatedAt: new Date(timestamp.getTime() - 1).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts only active newsroom media and cannot reference incident evidence', async () => {
    const newsroomMediaCount = resolved(0);
    const service = new LiveService(
      {
        liveUpdate: { findUnique: resolved(null) },
        newsroomMedia: { count: newsroomMediaCount },
      } as never,
      () => timestamp.getTime(),
    );

    await expect(
      service.addUpdate(
        eventId,
        {
          bodyHa: 'Sabuntawa',
          mediaId: '55555555-5555-4555-8555-555555555555',
          clientSubmissionId: submissionId,
        },
        actor as never,
      ),
    ).rejects.toThrow('selected newsroom image');
    expect(newsroomMediaCount).toHaveBeenCalledWith({
      where: {
        id: '55555555-5555-4555-8555-555555555555',
        status: 'ACTIVE',
        mediaType: 'IMAGE',
      },
    });
  });

  it('loads a bounded English feed and omits untranslated updates in the database query', async () => {
    const findMany = resolved([updateProjection({ bodyEn: 'English update' })]);
    const prisma = {
      liveEvent: {
        findFirst: resolved({
          id: eventId,
          slug: 'gwaji',
          titleHa: 'Gwaji',
          titleEn: 'Test',
          summaryHa: null,
          summaryEn: null,
          status: 'ACTIVE',
          isFeatured: false,
          startedAt: timestamp,
          closedAt: null,
          updatedAt: timestamp,
          nextSequence: 1,
          category: { slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
          featuredMedia: null,
          _count: { updates: 1 },
          updates: [{ updatedAt: timestamp }],
        }),
      },
      liveUpdate: { findMany },
    };
    const service = new LiveService(prisma as never, () => timestamp.getTime());
    const result = await service.publicDetail('gwaji', 'en');

    expect(result.title).toBe('Test');
    expect(result.updates[0]?.body).toBe('English update');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ bodyEn: { not: null } }, { withdrawnAt: { not: null } }],
        }),
        take: 21,
      }),
    );
  });
});
