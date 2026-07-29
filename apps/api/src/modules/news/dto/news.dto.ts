import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

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

const bilingualContentShape = {
  categoryCode: newsCategoryCodeSchema,
  titleHa: requiredText(5, 180),
  summaryHa: requiredText(10, 500),
  bodyHa: requiredText(20, 50_000),
  titleEn: optionalTranslation(5, 180),
  summaryEn: optionalTranslation(10, 500),
  bodyEn: optionalTranslation(20, 50_000),
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

export const createNewsArticleSchema = z
  .object(bilingualContentShape)
  .strict()
  .superRefine((value, context) => {
    requireCompleteEnglishTranslation(value, context);
    enforceCategoryContentLimits(value, context);
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
  });

export const newsArticleDecisionSchema = z
  .object({
    decision: z.enum(['SUBMIT_FOR_REVIEW', 'RETURN_TO_DRAFT', 'APPROVE_PUBLICATION', 'ARCHIVE']),
    reason: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((value) => value || undefined)
      .pipe(z.string().min(10).max(1000).optional()),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === 'RETURN_TO_DRAFT' && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A review reason is required when returning an article.',
      });
    }
  });

export const listNewsArticlesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(20),
    status: z.enum(NewsArticleStatus).optional(),
    authorId: z.uuid().optional(),
    category: newsCategoryCodeSchema.optional(),
  })
  .strict();

export const newsArticleIdSchema = z.object({ articleId: z.uuid() }).strict();

export type CreateNewsArticleDto = z.infer<typeof createNewsArticleSchema>;
export type UpdateNewsArticleDto = z.infer<typeof updateNewsArticleSchema>;
export type NewsArticleDecisionDto = z.infer<typeof newsArticleDecisionSchema>;
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
