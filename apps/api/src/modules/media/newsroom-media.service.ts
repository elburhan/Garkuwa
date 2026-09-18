import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { StaffPrincipal } from '../auth/auth.types.js';
import type {
  NewsroomMediaArchiveDto,
  NewsroomMediaListDto,
  NewsroomMediaUpdateDto,
  NewsroomMediaUploadDto,
} from './dto/newsroom-media.dto.js';
import { verifyNewsroomImage } from './newsroom-image-validation.js';
import { NEWSROOM_MEDIA_STORAGE, type NewsroomMediaStorage } from './newsroom-media-storage.js';

const mediaSelect = {
  id: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  mediaType: true,
  status: true,
  provenance: true,
  altTextHa: true,
  altTextEn: true,
  captionHa: true,
  captionEn: true,
  credit: true,
  source: true,
  rightsNotes: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, displayName: true } },
} as const;

function serialize<Media extends { createdAt: Date; updatedAt: Date }>(media: Media) {
  return {
    ...media,
    createdAt: media.createdAt.toISOString(),
    updatedAt: media.updatedAt.toISOString(),
  };
}

@Injectable()
export class NewsroomMediaService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NEWSROOM_MEDIA_STORAGE) private readonly storage: NewsroomMediaStorage,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.storage.initialize();
  }

  async onModuleDestroy(): Promise<void> {
    await this.storage.close?.();
  }

  async upload(
    file: Express.Multer.File | undefined,
    input: NewsroomMediaUploadDto,
    actor: StaffPrincipal,
  ) {
    if (!file) throw new NotFoundException('An image file is required.');
    const verified = verifyNewsroomImage(file);
    const duplicate = await this.prisma.newsroomMedia.findFirst({
      where: { sha256: verified.sha256 },
      select: { id: true },
    });
    await this.storage.putObject({
      objectKey: verified.storageKey,
      body: verified.body,
      contentType: verified.mimeType,
      contentLength: verified.sizeBytes,
    });
    try {
      const media = await this.prisma.newsroomMedia.create({
        data: {
          storageKey: verified.storageKey,
          originalFilename: verified.originalFilename,
          mimeType: verified.mimeType,
          sizeBytes: verified.sizeBytes,
          width: verified.width,
          height: verified.height,
          sha256: verified.sha256,
          provenance: input.provenance,
          altTextHa: input.altTextHa,
          altTextEn: input.altTextEn,
          captionHa: input.captionHa,
          captionEn: input.captionEn,
          credit: input.credit,
          source: input.source,
          rightsNotes: input.rightsNotes,
          uploadedById: actor.id,
        },
        select: mediaSelect,
      });
      return { media: serialize(media), exactDuplicateOfId: duplicate?.id ?? null };
    } catch (error) {
      await this.storage.deleteObject(verified.storageKey);
      throw error;
    }
  }

  async list(input: NewsroomMediaListDto) {
    const where = {
      status: input.status,
      ...(input.search
        ? {
            OR: [
              { originalFilename: { contains: input.search, mode: 'insensitive' as const } },
              { captionHa: { contains: input.search, mode: 'insensitive' as const } },
              { captionEn: { contains: input.search, mode: 'insensitive' as const } },
              { credit: { contains: input.search, mode: 'insensitive' as const } },
              {
                uploadedBy: {
                  displayName: { contains: input.search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };
    const [items, totalItems] = await Promise.all([
      this.prisma.newsroomMedia.findMany({
        where,
        select: mediaSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.newsroomMedia.count({ where }),
    ]);
    return {
      items: items.map(serialize),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async detail(mediaId: string) {
    const media = await this.prisma.newsroomMedia.findUnique({
      where: { id: mediaId },
      select: mediaSelect,
    });
    if (!media) throw new NotFoundException('Newsroom media not found.');
    return { media: serialize(media) };
  }

  async update(mediaId: string, input: NewsroomMediaUpdateDto) {
    const updatedAt = new Date();
    const { expectedUpdatedAt, ...metadata } = input;
    const result = await this.prisma.newsroomMedia.updateMany({
      where: { id: mediaId, updatedAt: new Date(expectedUpdatedAt), status: 'ACTIVE' },
      data: { ...metadata, updatedAt },
    });
    if (result.count !== 1)
      throw new ConflictException('Media changed or is no longer editable. Refresh and retry.');
    return this.detail(mediaId);
  }

  async archive(mediaId: string, input: NewsroomMediaArchiveDto) {
    const [articleReferences, liveEventReferences, liveUpdateReferences] = await Promise.all([
      this.prisma.newsArticle.count({
        where: {
          OR: [
            { featuredMediaId: mediaId },
            { socialMediaId: mediaId },
            { media: { some: { mediaId } } },
          ],
        },
      }),
      this.prisma.liveEvent.count({ where: { featuredMediaId: mediaId } }),
      this.prisma.liveUpdate.count({ where: { mediaId } }),
    ]);
    const references = articleReferences + liveEventReferences + liveUpdateReferences;
    if (references > 0)
      throw new ConflictException('Media linked to an article cannot be archived.');
    const result = await this.prisma.newsroomMedia.updateMany({
      where: { id: mediaId, updatedAt: new Date(input.expectedUpdatedAt), status: 'ACTIVE' },
      data: { status: 'ARCHIVED', updatedAt: new Date() },
    });
    if (result.count !== 1) throw new ConflictException('Media changed or is already archived.');
    return this.detail(mediaId);
  }

  async content(mediaId: string, publicOnly: boolean) {
    const media = await this.prisma.newsroomMedia.findFirst({
      where: {
        id: mediaId,
        status: 'ACTIVE',
        ...(publicOnly
          ? {
              OR: [
                { featuredArticles: { some: { status: 'PUBLISHED' } } },
                { socialArticles: { some: { status: 'PUBLISHED' } } },
                { articleLinks: { some: { article: { status: 'PUBLISHED' } } } },
                { featuredLiveEvents: { some: { status: { in: ['ACTIVE', 'CLOSED'] } } } },
                {
                  liveUpdates: {
                    some: {
                      withdrawnAt: null,
                      liveEvent: { status: { in: ['ACTIVE', 'CLOSED'] } },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: { storageKey: true, mimeType: true, sizeBytes: true },
    });
    if (!media) throw new NotFoundException('Newsroom media content is unavailable.');
    const object = await this.storage.getObject(media.storageKey);
    return { ...object, contentType: media.mimeType, contentLength: media.sizeBytes };
  }
}
