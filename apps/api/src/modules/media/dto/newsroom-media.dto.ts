import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { newsroomMediaMetadataSchema } from '@garkuwa/contracts/media';
import { z } from 'zod';

const nullableField = (maximum: number) =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().trim().max(maximum).nullable(),
  );

export const newsroomMediaUploadSchema = z
  .object({
    altTextHa: z.string().trim().min(5).max(500),
    altTextEn: nullableField(500),
    captionHa: nullableField(1000),
    captionEn: nullableField(1000),
    credit: nullableField(300),
    source: nullableField(500),
    rightsNotes: nullableField(2000),
    provenance: z.enum(['STAFF', 'AGENCY', 'OFFICIAL', 'CITIZEN_APPROVED', 'EXTERNAL', 'OTHER']),
  })
  .strict();

export const newsroomMediaUpdateSchema = newsroomMediaMetadataSchema.extend({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const newsroomMediaListSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(24),
    search: z.string().trim().max(100).optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  })
  .strict();

export const newsroomMediaIdSchema = z.object({ mediaId: z.uuid() }).strict();
export const newsroomMediaArchiveSchema = z
  .object({ expectedUpdatedAt: z.iso.datetime({ offset: true }) })
  .strict();

export class MediaZodPipe<Schema extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: Schema) {}
  transform(value: unknown): z.infer<Schema> {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException('Invalid newsroom media request.');
    return result.data;
  }
}

export type NewsroomMediaUploadDto = z.infer<typeof newsroomMediaUploadSchema>;
export type NewsroomMediaUpdateDto = z.infer<typeof newsroomMediaUpdateSchema>;
export type NewsroomMediaListDto = z.infer<typeof newsroomMediaListSchema>;
export type NewsroomMediaArchiveDto = z.infer<typeof newsroomMediaArchiveSchema>;
export type NewsroomMediaId = z.infer<typeof newsroomMediaIdSchema>;
