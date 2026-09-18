import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import {
  createLiveEventSchema,
  createLiveUpdateSchema,
  liveCorrectionRequestSchema,
  liveEventPublishingSchema,
  livePinRequestSchema,
  liveWithdrawalRequestSchema,
  updateLiveEventMetadataSchema,
} from '@garkuwa/contracts/live';
import { z } from 'zod';

export {
  createLiveEventSchema,
  createLiveUpdateSchema,
  liveEventPublishingSchema,
  liveCorrectionRequestSchema,
  livePinRequestSchema,
  liveWithdrawalRequestSchema,
  updateLiveEventMetadataSchema,
};

export const liveEventIdSchema = z.object({ eventId: z.uuid() }).strict();
export const liveUpdateIdSchema = z.object({ eventId: z.uuid(), updateId: z.uuid() }).strict();
export const listLiveEventsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(20),
    status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED']).optional(),
  })
  .strict();

export class LiveZodPipe<Schema extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: Schema) {}
  transform(value: unknown): z.infer<Schema> {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException('Invalid live coverage request.');
    return result.data;
  }
}

export type LiveEventId = z.infer<typeof liveEventIdSchema>;
export type LiveUpdateId = z.infer<typeof liveUpdateIdSchema>;
export type ListLiveEventsQuery = z.infer<typeof listLiveEventsQuerySchema>;
export type CreateLiveEventDto = z.infer<typeof createLiveEventSchema>;
export type UpdateLiveEventMetadataDto = z.infer<typeof updateLiveEventMetadataSchema>;
export type LiveEventPublishingDto = z.infer<typeof liveEventPublishingSchema>;
export type CreateLiveUpdateDto = z.infer<typeof createLiveUpdateSchema>;
export type LivePinDto = z.infer<typeof livePinRequestSchema>;
export type LiveCorrectionDto = z.infer<typeof liveCorrectionRequestSchema>;
export type LiveWithdrawalDto = z.infer<typeof liveWithdrawalRequestSchema>;
