import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import {
  newsroomAssignmentUpdateSchema,
  newsroomWorkflowActionSchema,
  type NewsroomAssignmentUpdate,
  type NewsroomWorkflowAction,
} from '@garkuwa/contracts';
import {
  articleCorrectionInputSchema,
  articleMediaUpdateSchema,
  articlePublishingMetadataSchema,
  richArticleBodySchema,
  type ArticleCorrectionInput,
  type ArticleMediaUpdate,
  type ArticlePublishingMetadata,
} from '@garkuwa/contracts/media';

import { NewsArticleStatus } from '../../../generated/prisma/enums.js';

const requiredText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);
const optionalTranslation = (minimum: number, maximum: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => (typeof value === 'string' ? value.trim() || null : null))
    .pipe(z.string().min(minimum).max(maximum).nullable());

export const newsCategoryCodes = [
  'ANNOUNCEMENTS',
  'SECURITY_ADVISORIES',
  'COMMUNITY_UPDATES',
  'FOUNDATION_ACTIVITIES',
  'LIVE_UPDATES',
  'NEWS',
] as const;
export const newsCategoryCodeSchema = z.enum(newsCategoryCodes);
export const securityAdvisorySeverities = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFORMATIONAL',
] as const;
export const securityAdvisorySeveritySchema = z.enum(securityAdvisorySeverities);

const advisoryReferenceSchema = z
  .object({
    label: requiredText(2, 160),
    url: z
      .string()
      .trim()
      .max(2000)
      .superRefine((value, context) => {
        try {
          const url = new URL(value);
          if (url.protocol !== 'https:' || url.username || url.password) {
            context.addIssue({ code: 'custom', message: 'Reference URLs must use HTTPS.' });
          }
        } catch {
          context.addIssue({ code: 'custom', message: 'Reference URL is invalid.' });
        }
      }),
  })
  .strict();

const securityAdvisorySchema = z
  .object({
    severity: securityAdvisorySeveritySchema,
    affectedAreaHa: requiredText(20, 1000),
    affectedAreaEn: optionalTranslation(20, 1000),
    recommendedActionsHa: requiredText(30, 3000),
    recommendedActionsEn: optionalTranslation(30, 3000),
    references: z.array(advisoryReferenceSchema).max(10).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.affectedAreaEn) !== Boolean(value.recommendedActionsEn)) {
      context.addIssue({
        code: 'custom',
        path: ['affectedAreaEn'],
        message: 'English affected area and recommended actions must be supplied together.',
      });
    }
    const normalized = new Set<string>();
    value.references.forEach((reference, index) => {
      try {
        const url = new URL(reference.url);
        url.hash = '';
        const key = url.href.toLowerCase();
        if (normalized.has(key)) {
          context.addIssue({
            code: 'custom',
            path: ['references', index, 'url'],
            message: 'Duplicate reference URLs are not allowed.',
          });
        }
        normalized.add(key);
      } catch {
        // The URL field reports the format error.
      }
    });
  });

const bilingualContentShape = {
  categoryCode: newsCategoryCodeSchema,
  securityAdvisory: securityAdvisorySchema.nullable().optional().default(null),
  titleHa: requiredText(5, 180),
  summaryHa: requiredText(10, 500),
  bodyHa: requiredText(20, 50_000),
  bodyBlocksHa: richArticleBodySchema.optional(),
  titleEn: optionalTranslation(5, 180),
  summaryEn: optionalTranslation(10, 500),
  bodyEn: optionalTranslation(20, 50_000),
  bodyBlocksEn: richArticleBodySchema.optional(),
  changeNote: z.string().trim().min(3).max(1000).optional(),
};

function requireCompleteEnglishTranslation(
  value: { titleEn: string | null; summaryEn: string | null; bodyEn: string | null },
  context: z.RefinementCtx,
): void {
  const count = [value.titleEn, value.summaryEn, value.bodyEn].filter(Boolean).length;
  if (count !== 0 && count !== 3) {
    context.addIssue({
      code: 'custom',
      path: ['titleEn'],
      message: 'English title, summary, and body must be supplied together.',
    });
  }
}

function enforceCategoryContentLimits(
  value: {
    categoryCode: z.infer<typeof newsCategoryCodeSchema>;
    titleHa: string;
    summaryHa: string;
    bodyHa: string;
    titleEn: string | null;
    summaryEn: string | null;
    bodyEn: string | null;
  },
  context: z.RefinementCtx,
): void {
  const limits =
    value.categoryCode === 'LIVE_UPDATES'
      ? { title: 140, summaryMin: 10, summaryMax: 280, bodyMin: 20, bodyMax: 1000 }
      : { title: 180, summaryMin: 20, summaryMax: 500, bodyMin: 100, bodyMax: 50_000 };
  const fields = [
    ['titleHa', value.titleHa, 5, limits.title],
    ['summaryHa', value.summaryHa, limits.summaryMin, limits.summaryMax],
    ['bodyHa', value.bodyHa, limits.bodyMin, limits.bodyMax],
    ['titleEn', value.titleEn, 5, limits.title],
    ['summaryEn', value.summaryEn, limits.summaryMin, limits.summaryMax],
    ['bodyEn', value.bodyEn, limits.bodyMin, limits.bodyMax],
  ] as const;
  for (const [path, text, minimum, maximum] of fields) {
    if (text !== null && (text.length < minimum || text.length > maximum)) {
      context.addIssue({
        code: 'custom',
        path: [path],
        message: `Content must contain between ${minimum} and ${maximum} characters.`,
      });
    }
  }
}

function enforceSecurityAdvisoryRules(
  value: {
    categoryCode: z.infer<typeof newsCategoryCodeSchema>;
    titleEn: string | null;
    summaryEn: string | null;
    bodyEn: string | null;
    securityAdvisory?: z.infer<typeof securityAdvisorySchema> | null;
  },
  context: z.RefinementCtx,
): void {
  if (value.categoryCode === 'SECURITY_ADVISORIES') {
    if (!value.securityAdvisory) {
      context.addIssue({
        code: 'custom',
        path: ['securityAdvisory'],
        message: 'Structured security advisory fields are required.',
      });
      return;
    }
    const articleHasEnglish = Boolean(value.titleEn && value.summaryEn && value.bodyEn);
    const advisoryHasEnglish = Boolean(
      value.securityAdvisory.affectedAreaEn && value.securityAdvisory.recommendedActionsEn,
    );
    if (articleHasEnglish !== advisoryHasEnglish) {
      context.addIssue({
        code: 'custom',
        path: ['securityAdvisory', 'affectedAreaEn'],
        message: 'English article and advisory content must be complete together.',
      });
    }
  } else if (value.securityAdvisory) {
    context.addIssue({
      code: 'custom',
      path: ['securityAdvisory'],
      message: 'Security advisory fields are only valid for security advisories.',
    });
  }
}

export const createNewsArticleSchema = z
  .object(bilingualContentShape)
  .strict()
  .superRefine((value, context) => {
    requireCompleteEnglishTranslation(value, context);
    enforceCategoryContentLimits(value, context);
    enforceSecurityAdvisoryRules(value, context);
  });

export const updateNewsArticleSchema = z
  .object({
    ...bilingualContentShape,
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    requireCompleteEnglishTranslation(value, context);
    enforceCategoryContentLimits(value, context);
    enforceSecurityAdvisoryRules(value, context);
  });

export const newsArticleDecisionSchema = newsroomWorkflowActionSchema;
export const newsArticleAssignmentSchema = newsroomAssignmentUpdateSchema;
export const newsArticleMediaSchema = articleMediaUpdateSchema;
export const newsArticlePublishingMetadataSchema = articlePublishingMetadataSchema;
export const newsArticleCorrectionSchema = articleCorrectionInputSchema;

const contributorRoleSchema = z.enum([
  'AUTHOR',
  'REPORTER',
  'EDITOR',
  'PHOTO',
  'VIDEO',
  'TRANSLATOR',
]);
const sourceTypeSchema = z.enum([
  'STAFF_REPORTER',
  'CITIZEN_SOURCE',
  'OFFICIAL_STATEMENT',
  'PRESS_RELEASE',
  'AGENCY',
  'INTERVIEW',
  'DOCUMENT',
  'OTHER_PUBLICATION',
]);
const metadataLocationSchema = z
  .object({
    country: requiredText(2, 100).default('Nigeria'),
    state: z.string().trim().max(100).nullable().default(null),
    lga: z.string().trim().max(100).nullable().default(null),
    place: z.string().trim().max(160).nullable().default(null),
  })
  .strict();
const metadataSourceSchema = z
  .object({
    id: z.uuid().optional(),
    type: sourceTypeSchema,
    publicLabel: z.string().trim().max(300).nullable().default(null),
    organization: z.string().trim().max(200).nullable().default(null),
    url: z.string().trim().url().max(2000).nullable().default(null),
    confidential: z.boolean().default(false),
    internalNotes: z.string().max(50_000).nullable().default(null),
    displayOrder: z.number().int().nonnegative().default(0),
  })
  .strict();

export const newsArticleMetadataSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    contributors: z
      .array(
        z
          .object({
            contributorId: z.uuid(),
            role: contributorRoleSchema,
            displayOrder: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    tagIds: z.array(z.uuid()).max(30).default([]),
    topicIds: z.array(z.uuid()).max(30).default([]),
    locations: z.array(metadataLocationSchema).max(20).default([]),
    sources: z.array(metadataSourceSchema).max(20).default([]),
  })
  .strict();

export const contributorCreateSchema = z
  .object({
    displayName: requiredText(2, 160),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    bio: z.string().trim().max(1000).nullable().default(null),
    userId: z.uuid().nullable().default(null),
    publicStatus: z.enum(['PRIVATE', 'PUBLIC']).default('PRIVATE'),
  })
  .strict();

export const tagCreateSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: requiredText(2, 100),
  })
  .strict();

export const topicCreateSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    nameHa: requiredText(2, 160),
    nameEn: z.string().trim().max(160).nullable().default(null),
  })
  .strict();

export const catalogIdSchema = z.object({ id: z.uuid() }).strict();
export const tagUpdateSchema = tagCreateSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();
export const topicUpdateSchema = topicCreateSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();
export const contributorUpdateSchema = contributorCreateSchema.partial().strict();

export const listNewsArticlesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(20),
    status: z.enum(NewsArticleStatus).optional(),
    authorId: z.uuid().optional(),
    category: newsCategoryCodeSchema.optional(),
    severity: securityAdvisorySeveritySchema.optional(),
    view: z
      .enum([
        'ALL',
        'MY_DRAFTS',
        'ASSIGNED_TO_ME',
        'NEEDS_REVIEW',
        'CHANGES_REQUESTED',
        'READY_TO_PUBLISH',
        'PUBLISHED_TODAY',
      ])
      .default('ALL'),
    assignedWriterId: z.uuid().optional(),
    assignedReviewerId: z.uuid().optional(),
    desk: z
      .enum([
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
      ])
      .optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    language: z.enum(['HAUSA_ONLY', 'BILINGUAL']).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.severity && value.category !== 'SECURITY_ADVISORIES') {
      context.addIssue({
        code: 'custom',
        path: ['severity'],
        message: 'Severity requires the security advisory category.',
      });
    }
  });

export const newsArticleIdSchema = z.object({ articleId: z.uuid() }).strict();

export type CreateNewsArticleDto = z.infer<typeof createNewsArticleSchema>;
export type UpdateNewsArticleDto = z.infer<typeof updateNewsArticleSchema>;
export type NewsArticleDecisionDto = NewsroomWorkflowAction;
export type NewsArticleAssignmentDto = NewsroomAssignmentUpdate;
export type NewsArticleMetadataDto = z.infer<typeof newsArticleMetadataSchema>;
export type NewsArticleMediaDto = ArticleMediaUpdate;
export type NewsArticlePublishingMetadataDto = ArticlePublishingMetadata;
export type NewsArticleCorrectionDto = ArticleCorrectionInput;
export type ContributorCreateDto = z.infer<typeof contributorCreateSchema>;
export type TagCreateDto = z.infer<typeof tagCreateSchema>;
export type TopicCreateDto = z.infer<typeof topicCreateSchema>;
export type TagUpdateDto = z.infer<typeof tagUpdateSchema>;
export type TopicUpdateDto = z.infer<typeof topicUpdateSchema>;
export type ContributorUpdateDto = z.infer<typeof contributorUpdateSchema>;
export type ListNewsArticlesQuery = z.infer<typeof listNewsArticlesQuerySchema>;
export type NewsArticleId = z.infer<typeof newsArticleIdSchema>;

export class NewsZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The editorial news request is invalid.',
      });
    }
    return result.data;
  }
}
