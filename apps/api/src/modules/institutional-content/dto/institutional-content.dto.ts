import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export const institutionalPageKeys = [
  'ABOUT',
  'FAQ',
  'HELP',
  'CONTACT',
  'SAFETY_GUIDANCE',
] as const;
export const institutionalPageKeySchema = z.enum(institutionalPageKeys);
export const institutionalPageKeyParamSchema = z
  .object({ pageKey: institutionalPageKeySchema })
  .strict();

const optionalText = (minimum: number, maximum: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => (typeof value === 'string' ? value.trim() || null : null))
    .pipe(z.string().min(minimum).max(maximum).nullable());

const sectionSchema = z
  .object({
    sectionKey: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(2)
      .max(60),
    headingHa: z.string().trim().min(3).max(180),
    bodyHa: z.string().trim().min(20).max(10_000),
    headingEn: optionalText(3, 180),
    bodyEn: optionalText(20, 10_000),
  })
  .strict();

export const saveInstitutionalDraftSchema = z
  .object({
    titleHa: z.string().trim().min(5).max(180),
    summaryHa: optionalText(0, 500),
    titleEn: optionalText(5, 180),
    summaryEn: optionalText(0, 500),
    sections: z.array(sectionSchema).min(1).max(20),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = new Set<string>();
    value.sections.forEach((section, index) => {
      if (keys.has(section.sectionKey)) {
        context.addIssue({
          code: 'custom',
          path: ['sections', index, 'sectionKey'],
          message: 'Section keys must be unique.',
        });
      }
      keys.add(section.sectionKey);
    });
    const englishValues = [
      value.titleEn,
      value.summaryEn,
      ...value.sections.flatMap((section) => [section.headingEn, section.bodyEn]),
    ];
    const hasEnglish = englishValues.some(Boolean);
    if (
      hasEnglish &&
      (!value.titleEn ||
        (Boolean(value.summaryHa) && !value.summaryEn) ||
        (!value.summaryHa && Boolean(value.summaryEn)) ||
        value.sections.some((section) => !section.headingEn || !section.bodyEn))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['titleEn'],
        message: 'English content must be complete for the whole revision.',
      });
    }
    const combinedLength = [
      value.titleHa,
      value.summaryHa,
      value.titleEn,
      value.summaryEn,
      ...value.sections.flatMap((section) => [
        section.headingHa,
        section.bodyHa,
        section.headingEn,
        section.bodyEn,
      ]),
    ].reduce((total, text) => total + (text?.length ?? 0), 0);
    if (combinedLength > 50_000) {
      context.addIssue({
        code: 'custom',
        path: ['sections'],
        message: 'Combined revision content must not exceed 50,000 characters.',
      });
    }
  });

export const institutionalPageDecisionSchema = z
  .object({
    decision: z.enum(['SUBMIT_FOR_REVIEW', 'RETURN_TO_DRAFT', 'PUBLISH']),
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
        message: 'A correction reason is required.',
      });
    }
  });

export const publicInstitutionalPageQuerySchema = z
  .object({ lang: z.enum(['ha', 'en']).default('ha') })
  .strict();

export type InstitutionalPageKeyParam = z.infer<typeof institutionalPageKeyParamSchema>;
export type SaveInstitutionalDraftDto = z.infer<typeof saveInstitutionalDraftSchema>;
export type InstitutionalPageDecisionDto = z.infer<typeof institutionalPageDecisionSchema>;
export type PublicInstitutionalPageQuery = z.infer<typeof publicInstitutionalPageQuerySchema>;

export class InstitutionalContentZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The institutional content request is invalid.',
      });
    }
    return parsed.data;
  }
}
