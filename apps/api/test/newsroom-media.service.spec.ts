import { ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';

import { NewsroomMediaService } from '../src/modules/media/newsroom-media.service.js';

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'editor@example.test',
  displayName: 'Test Editor',
  role: 'EDITOR',
} as const;

function png(): Buffer {
  const value = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(value);
  value.writeUInt32BE(640, 16);
  value.writeUInt32BE(360, 20);
  return value;
}

describe('NewsroomMediaService', () => {
  const findFirst = jest.fn<(parameters: unknown) => Promise<unknown>>();
  const create = jest.fn<(parameters: unknown) => Promise<unknown>>();
  const count = jest.fn<() => Promise<number>>();
  const liveEventCount = jest.fn<() => Promise<number>>();
  const liveUpdateCount = jest.fn<() => Promise<number>>();
  const updateMany = jest.fn<() => Promise<{ count: number }>>();
  const findUnique = jest.fn<() => Promise<unknown>>();
  const putObject = jest.fn<() => Promise<void>>();
  const deleteObject = jest.fn<() => Promise<void>>();
  const getObject = jest.fn<() => Promise<unknown>>();
  const prisma = {
    newsroomMedia: { findFirst, create, updateMany, findUnique },
    newsArticle: { count },
    liveEvent: { count: liveEventCount },
    liveUpdate: { count: liveUpdateCount },
  };
  const storage = { initialize: jest.fn(), putObject, deleteObject, getObject };
  const service = new NewsroomMediaService(prisma as never, storage as never);

  beforeEach(() => {
    jest.clearAllMocks();
    liveEventCount.mockResolvedValue(0);
    liveUpdateCount.mockResolvedValue(0);
  });

  it('stores verified images in the newsroom namespace and exposes no private storage fields', async () => {
    findFirst.mockResolvedValue(null);
    create.mockImplementation(async (parameters?: unknown) => {
      const data = (parameters as { data: Record<string, unknown> }).data;
      expect(data.storageKey).toMatch(/^newsroom\/images\//);
      expect(data.sha256).toMatch(/^[0-9a-f]{64}$/);
      return {
        id: '22222222-2222-4222-8222-222222222222',
        originalFilename: 'photo.png',
        mimeType: 'image/png',
        sizeBytes: 24,
        width: 640,
        height: 360,
        mediaType: 'IMAGE',
        status: 'ACTIVE',
        provenance: 'STAFF',
        altTextHa: 'Bayanan hoton gwaji',
        altTextEn: null,
        captionHa: null,
        captionEn: null,
        credit: null,
        source: null,
        rightsNotes: null,
        createdAt: new Date('2026-09-15T10:00:00.000Z'),
        updatedAt: new Date('2026-09-15T10:00:00.000Z'),
        uploadedBy: { id: actor.id, displayName: actor.displayName },
      };
    });

    const result = await service.upload(
      { originalname: 'photo.png', mimetype: 'image/png', buffer: png() } as Express.Multer.File,
      {
        provenance: 'STAFF',
        altTextHa: 'Bayanan hoton gwaji',
        altTextEn: null,
        captionHa: null,
        captionEn: null,
        credit: null,
        source: null,
        rightsNotes: null,
      },
      actor as never,
    );

    expect(putObject).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toMatch(/storageKey|sha256|objectKey/);
  });

  it('does not archive media referenced by any article', async () => {
    count.mockResolvedValue(1);
    await expect(
      service.archive('22222222-2222-4222-8222-222222222222', {
        expectedUpdatedAt: '2026-09-15T10:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('requires a published article relationship for public content delivery', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.content('22222222-2222-4222-8222-222222222222', true)).rejects.toThrow(
      'Newsroom media content is unavailable.',
    );
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        status: 'ACTIVE',
        OR: expect.any(Array),
      },
      select: { storageKey: true, mimeType: true, sizeBytes: true },
    });
    expect(getObject).not.toHaveBeenCalled();
  });
});
