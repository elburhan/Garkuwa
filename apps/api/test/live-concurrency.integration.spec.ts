import { randomUUID } from 'node:crypto';

import { PrismaService } from '../src/database/prisma.service.js';
import { LiveService } from '../src/modules/live/live.service.js';

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

databaseDescribe('live update PostgreSQL concurrency', () => {
  const prisma = new PrismaService();
  const marker = randomUUID().slice(0, 8);
  let userId: string;
  let categoryId: string;
  let eventId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `live-concurrency-${marker}@example.test`,
        passwordHash: 'not-used-by-this-test',
        displayName: 'Live concurrency test',
        role: 'EDITOR',
      },
      select: { id: true },
    });
    userId = user.id;
    const category = await prisma.newsCategory.create({
      data: {
        code: `LIVE_TEST_${marker.toUpperCase()}`,
        slug: `live-test-${marker}`,
        nameHa: 'Gwajin kai tsaye',
        nameEn: 'Live test',
        displayOrder: 9999,
      },
      select: { id: true },
    });
    categoryId = category.id;
    const event = await prisma.liveEvent.create({
      data: {
        slug: `live-concurrency-${marker}`,
        titleHa: 'Gwajin wallafawa lokaci guda',
        status: 'ACTIVE',
        categoryId,
        createdById: userId,
        startedAt: new Date(),
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    if (eventId) await prisma.liveEvent.delete({ where: { id: eventId } });
    if (categoryId) await prisma.newsCategory.delete({ where: { id: categoryId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('publishes 20 updates with unique gap-free event-local sequences', async () => {
    const service = new LiveService(prisma, Date.now);
    const actor = {
      id: userId,
      email: `live-concurrency-${marker}@example.test`,
      name: 'Live concurrency test',
      role: 'EDITOR' as const,
    };
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        service.addUpdate(
          eventId,
          {
            bodyHa: `Sabuntawa ${index + 1}`,
            clientSubmissionId: randomUUID(),
          },
          actor,
        ),
      ),
    );
    const sequences = results.map(({ update }) => update.sequence).sort((a, b) => a - b);
    const stored = await prisma.liveUpdate.findMany({
      where: { liveEventId: eventId },
      select: { sequence: true, bodyHa: true },
      orderBy: { sequence: 'asc' },
    });

    expect(sequences).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(new Set(sequences).size).toBe(20);
    expect(stored).toHaveLength(20);
    expect(new Set(stored.map((item) => item.bodyHa)).size).toBe(20);
  });
});
