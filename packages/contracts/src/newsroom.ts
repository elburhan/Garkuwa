import { z } from 'zod';

export const newsroomStatuses = [
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED',
] as const;
export const newsroomStatusSchema = z.enum(newsroomStatuses);

export const newsroomCapabilities = [
  'NEWS_VIEW',
  'NEWS_CREATE',
  'NEWS_EDIT_OWN',
  'NEWS_EDIT_ANY',
  'NEWS_SUBMIT_REVIEW',
  'NEWS_REVIEW',
  'NEWS_RETURN_FOR_CHANGES',
  'NEWS_MARK_READY',
  'NEWS_PUBLISH',
  'NEWS_UNPUBLISH',
  'NEWS_ARCHIVE',
  'NEWS_ASSIGN',
  'NEWS_MANAGE_ASSIGNMENTS',
  'LIVE_CREATE',
  'LIVE_UPDATE',
  'LIVE_PUBLISH',
  'MEDIA_USE',
  'MEDIA_UPLOAD',
  'MEDIA_EDIT',
  'MEDIA_ARCHIVE',
  'MEDIA_MANAGE',
  'STAFF_MANAGE',
] as const;
export const newsroomCapabilitySchema = z.enum(newsroomCapabilities);

export const newsroomDesks = [
  'GENERAL',
  'POLITICS',
  'SECURITY',
  'BUSINESS',
  'EDUCATION',
  'HEALTH',
  'AGRICULTURE',
  'TECHNOLOGY',
  'SPORTS',
  'CULTURE',
] as const;
export const newsroomDeskSchema = z.enum(newsroomDesks);
export const newsroomPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const newsroomPrioritySchema = z.enum(newsroomPriorities);

export const newsroomWorkflowDecisions = [
  'SUBMIT_FOR_REVIEW',
  'REQUEST_CHANGES',
  'MARK_READY_TO_PUBLISH',
  'PUBLISH',
  'UNPUBLISH',
  'ARCHIVE',
] as const;
export const newsroomWorkflowActionSchema = z
  .object({
    decision: z.enum(newsroomWorkflowDecisions),
    reason: z.string().trim().min(10).max(1000).optional(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === 'REQUEST_CHANGES' && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reason is required when requesting changes.',
      });
    }
  });

const nullableUuid = z.uuid().nullable();
export const newsroomAssignmentUpdateSchema = z
  .object({
    assignedWriterId: nullableUuid,
    assignedReviewerId: nullableUuid,
    desk: newsroomDeskSchema.nullable(),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    priority: newsroomPrioritySchema,
    reason: z.string().trim().min(10).max(1000).optional(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const newsroomListViews = [
  'ALL',
  'MY_DRAFTS',
  'ASSIGNED_TO_ME',
  'NEEDS_REVIEW',
  'CHANGES_REQUESTED',
  'READY_TO_PUBLISH',
  'PUBLISHED_TODAY',
] as const;
export const newsroomArticleListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(20),
    view: z.enum(newsroomListViews).default('ALL'),
    status: newsroomStatusSchema.optional(),
    authorId: z.uuid().optional(),
    assignedWriterId: z.uuid().optional(),
    assignedReviewerId: z.uuid().optional(),
    desk: newsroomDeskSchema.optional(),
    category: z.string().trim().min(1).max(40).optional(),
    language: z.enum(['HAUSA_ONLY', 'BILINGUAL']).optional(),
    priority: newsroomPrioritySchema.optional(),
  })
  .strict();

export const newsroomStaffIdentitySchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
});

export const newsroomCategorySchema = z.object({
  code: z.string(),
  slug: z.string(),
  nameHa: z.string(),
  nameEn: z.string(),
});

export const newsroomContributorRoleSchema = z.enum([
  'AUTHOR',
  'REPORTER',
  'EDITOR',
  'PHOTO',
  'VIDEO',
  'TRANSLATOR',
]);
export const newsroomPublicContributorSchema = z.object({
  displayName: z.string(),
  slug: z.string(),
  contributorRole: newsroomContributorRoleSchema,
});

export const newsroomArticleListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  status: newsroomStatusSchema,
  titleHa: z.string(),
  titleEn: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  submittedForReviewAt: z.iso.datetime({ offset: true }).nullable(),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
  priority: newsroomPrioritySchema,
  desk: newsroomDeskSchema.nullable(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  author: newsroomStaffIdentitySchema,
  assignedWriter: newsroomStaffIdentitySchema.nullable(),
  assignedReviewer: newsroomStaffIdentitySchema.nullable(),
  category: newsroomCategorySchema,
  languageCompleteness: z.enum(['HAUSA_ONLY', 'BILINGUAL']).optional(),
  securityAdvisory: z.object({ severity: z.string() }).nullable(),
});

export const newsroomArticleListResponseSchema = z.object({
  items: z.array(newsroomArticleListItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

const newsroomRevisionSchema = z.object({
  id: z.uuid(),
  revisionNumber: z.number().int().positive(),
  titleHa: z.string(),
  summaryHa: z.string(),
  bodyHa: z.string(),
  titleEn: z.string().nullable(),
  summaryEn: z.string().nullable(),
  bodyEn: z.string().nullable(),
  changeNote: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  createdBy: newsroomStaffIdentitySchema,
});

export const newsroomArticleDetailSchema = z.object({
  article: z.object({
    id: z.uuid(),
    slug: z.string(),
    status: newsroomStatusSchema,
    titleHa: z.string(),
    summaryHa: z.string(),
    bodyHa: z.string(),
    titleEn: z.string().nullable(),
    summaryEn: z.string().nullable(),
    bodyEn: z.string().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    submittedForReviewAt: z.iso.datetime({ offset: true }).nullable(),
    publishedAt: z.iso.datetime({ offset: true }).nullable(),
    archivedAt: z.iso.datetime({ offset: true }).nullable(),
    draftRevisionId: z.uuid().nullable(),
    submittedRevisionId: z.uuid().nullable(),
    publishedRevisionId: z.uuid().nullable(),
    desk: newsroomDeskSchema.nullable(),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    priority: newsroomPrioritySchema,
    author: newsroomStaffIdentitySchema,
    assignedWriter: newsroomStaffIdentitySchema.nullable(),
    assignedReviewer: newsroomStaffIdentitySchema.nullable(),
    category: newsroomCategorySchema,
    revisions: z.array(newsroomRevisionSchema),
    contributors: z.array(
      z.object({
        role: newsroomContributorRoleSchema,
        displayOrder: z.number().int(),
        contributor: z.object({
          id: z.uuid(),
          displayName: z.string(),
          slug: z.string(),
          publicStatus: z.string(),
        }),
      }),
    ),
    tags: z.array(
      z.object({ tag: z.object({ id: z.uuid(), slug: z.string(), name: z.string() }) }),
    ),
    topics: z.array(
      z.object({
        topic: z.object({
          id: z.uuid(),
          slug: z.string(),
          nameHa: z.string(),
          nameEn: z.string().nullable(),
        }),
      }),
    ),
    locations: z.array(
      z.object({
        id: z.uuid(),
        country: z.string(),
        state: z.string().nullable(),
        lga: z.string().nullable(),
        place: z.string().nullable(),
      }),
    ),
    sources: z.array(
      z.object({
        id: z.uuid(),
        type: z.string(),
        publicLabel: z.string().nullable(),
        url: z.string().nullable(),
        organization: z.string().nullable(),
        confidential: z.boolean(),
        internalNotes: z.string().nullable(),
      }),
    ),
    assignmentHistory: z.array(
      z.object({
        id: z.uuid(),
        fromDesk: newsroomDeskSchema.nullable(),
        toDesk: newsroomDeskSchema.nullable(),
        fromDueAt: z.iso.datetime({ offset: true }).nullable(),
        toDueAt: z.iso.datetime({ offset: true }).nullable(),
        fromPriority: newsroomPrioritySchema,
        toPriority: newsroomPrioritySchema,
        reason: z.string().nullable(),
        createdAt: z.iso.datetime({ offset: true }),
        changedBy: newsroomStaffIdentitySchema,
      }),
    ),
    securityAdvisory: z
      .object({
        severity: z.string(),
        affectedAreaHa: z.string(),
        affectedAreaEn: z.string().nullable(),
        recommendedActionsHa: z.string(),
        recommendedActionsEn: z.string().nullable(),
        referencesJson: z.array(z.object({ label: z.string(), url: z.string() })),
      })
      .nullable(),
  }),
});

export type NewsroomCapability = z.infer<typeof newsroomCapabilitySchema>;
export type NewsroomWorkflowAction = z.infer<typeof newsroomWorkflowActionSchema>;
export type NewsroomAssignmentUpdate = z.infer<typeof newsroomAssignmentUpdateSchema>;
export type NewsroomArticleListQuery = z.infer<typeof newsroomArticleListQuerySchema>;
export type NewsroomArticleListResponse = z.infer<typeof newsroomArticleListResponseSchema>;
export type NewsroomArticleDetail = z.infer<typeof newsroomArticleDetailSchema>;
