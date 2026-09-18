import { z } from 'zod';

import { publicMediaSchema } from './media.js';

export const liveEventStatuses = ['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'] as const;
export const publicLiveEventStatuses = ['ACTIVE', 'CLOSED'] as const;
export const liveLifecycleActions = ['START', 'CLOSE', 'REOPEN', 'ARCHIVE'] as const;
export const liveEventCategoryCodes = [
  'ANNOUNCEMENTS',
  'SECURITY_ADVISORIES',
  'COMMUNITY_UPDATES',
  'FOUNDATION_ACTIVITIES',
  'LIVE_UPDATES',
  'NEWS',
] as const;

const nullableShortText = z.string().trim().min(1).max(180).nullable().optional();
const nullableSummary = z.string().trim().min(1).max(500).nullable().optional();

export const createLiveEventSchema = z
  .object({
    categoryCode: z.enum(liveEventCategoryCodes),
    titleHa: z.string().trim().min(1).max(180),
    titleEn: nullableShortText,
    summaryHa: nullableSummary,
    summaryEn: nullableSummary,
  })
  .strict();

export const updateLiveEventMetadataSchema = createLiveEventSchema
  .extend({
    featuredMediaId: z.uuid().nullable(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const liveEventPublishingSchema = z
  .object({
    action: z.enum(liveLifecycleActions),
    isFeatured: z.boolean(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const createLiveUpdateSchema = z
  .object({
    headlineHa: nullableShortText,
    headlineEn: nullableShortText,
    bodyHa: z.string().trim().min(1).max(5000),
    bodyEn: z.string().trim().min(1).max(5000).nullable().optional(),
    mediaId: z.uuid().nullable().optional(),
    clientSubmissionId: z.uuid(),
  })
  .strict();

export const livePinRequestSchema = z
  .object({
    isPinned: z.boolean(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const liveCorrectionRequestSchema = z
  .object({
    headlineHa: nullableShortText,
    headlineEn: nullableShortText,
    bodyHa: z.string().trim().min(1).max(5000),
    bodyEn: z.string().trim().min(1).max(5000).nullable().optional(),
    reason: z.string().trim().min(10).max(1000),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const liveWithdrawalRequestSchema = z
  .object({
    reason: z.string().trim().min(10).max(1000),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const publicLiveUpdateSchema = z
  .object({
    id: z.uuid(),
    sequence: z.number().int().positive(),
    headline: z.string().nullable(),
    body: z.string().nullable(),
    isPinned: z.boolean(),
    isWithdrawn: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    correctedAt: z.iso.datetime({ offset: true }).nullable(),
    media: publicMediaSchema.nullable(),
  })
  .strict();

export const liveUpdateRevisionSchema = z
  .object({
    id: z.uuid(),
    headlineHa: z.string().nullable(),
    headlineEn: z.string().nullable(),
    bodyHa: z.string(),
    bodyEn: z.string().nullable(),
    reason: z.string(),
    createdAt: z.iso.datetime({ offset: true }),
    createdBy: z.object({ id: z.uuid(), displayName: z.string() }).strict(),
  })
  .strict();

export const publicLiveEventListItemSchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    status: z.enum(publicLiveEventStatuses),
    isFeatured: z.boolean(),
    hasEnglishTranslation: z.boolean(),
    startedAt: z.iso.datetime({ offset: true }),
    closedAt: z.iso.datetime({ offset: true }).nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
    latestUpdateAt: z.iso.datetime({ offset: true }).nullable(),
    updateCount: z.number().int().nonnegative(),
    category: z.object({ slug: z.string(), name: z.string() }).strict(),
    featuredMedia: publicMediaSchema.nullable(),
  })
  .strict();

export const publicLiveEventDetailSchema = publicLiveEventListItemSchema.extend({
  updates: z.array(publicLiveUpdateSchema),
  latestSequence: z.number().int().nonnegative(),
  oldestSequence: z.number().int().positive().nullable(),
  hasOlder: z.boolean(),
});

export const liveEventSummarySchema = publicLiveEventListItemSchema;
export const liveEventDetailSchema = publicLiveEventDetailSchema;
export const liveUpdateSchema = publicLiveUpdateSchema;
export const liveUpdateMediaSchema = publicMediaSchema;

export const publicLiveEventListSchema = z
  .object({
    generatedAt: z.iso.datetime({ offset: true }),
    items: z.array(publicLiveEventListItemSchema),
    pagination: z
      .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        totalItems: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const liveIncrementalResponseSchema = z
  .object({
    generatedAt: z.iso.datetime({ offset: true }),
    updates: z.array(publicLiveUpdateSchema),
    latestSequence: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  })
  .strict();

export type CreateLiveEventInput = z.infer<typeof createLiveEventSchema>;
export type UpdateLiveEventMetadataInput = z.infer<typeof updateLiveEventMetadataSchema>;
export type LiveEventPublishingInput = z.infer<typeof liveEventPublishingSchema>;
export type CreateLiveUpdateInput = z.infer<typeof createLiveUpdateSchema>;
export type LivePinRequest = z.infer<typeof livePinRequestSchema>;
export type LiveCorrectionRequest = z.infer<typeof liveCorrectionRequestSchema>;
export type LiveWithdrawalRequest = z.infer<typeof liveWithdrawalRequestSchema>;
export type PublicLiveUpdate = z.infer<typeof publicLiveUpdateSchema>;
export type LiveUpdateRevision = z.infer<typeof liveUpdateRevisionSchema>;
export type PublicLiveEventListItem = z.infer<typeof publicLiveEventListItemSchema>;
export type PublicLiveEventDetail = z.infer<typeof publicLiveEventDetailSchema>;
export type PublicLiveEventList = z.infer<typeof publicLiveEventListSchema>;
export type LiveIncrementalResponse = z.infer<typeof liveIncrementalResponseSchema>;
export type LiveEventSummary = z.infer<typeof liveEventSummarySchema>;
export type LiveEventDetail = z.infer<typeof liveEventDetailSchema>;
export type LiveUpdate = z.infer<typeof liveUpdateSchema>;
export type LiveUpdateMedia = z.infer<typeof liveUpdateMediaSchema>;
export type LiveLifecycleAction = (typeof liveLifecycleActions)[number];
