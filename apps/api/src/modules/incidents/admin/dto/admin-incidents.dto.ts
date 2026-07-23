import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

import {
  IncidentSeverity,
  IncidentStatus,
  SubmissionLanguage,
} from '../../../../generated/prisma/enums.js';

const strictDate = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!strictDate.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month! - 1 &&
    parsed.getUTCDate() === day
  );
}

const optionalFilterText = z.string().trim().min(1).max(100).optional();
const optionalDate = z
  .string()
  .refine(isCalendarDate, 'Use a valid date in YYYY-MM-DD format.')
  .optional();

export const listAdminIncidentsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(IncidentStatus).optional(),
    severity: z.enum(IncidentSeverity).optional(),
    categoryId: z.uuid().optional(),
    submissionLanguage: z.enum(SubmissionLanguage).optional(),
    state: optionalFilterText,
    lga: optionalFilterText,
    dateFrom: optionalDate,
    dateTo: optionalDate,
    search: z.string().trim().min(1).max(120).optional(),
    sort: z.enum(['newest', 'oldest', 'severity', 'status']).default('newest'),
  })
  .strict()
  .superRefine((query, context) => {
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      context.addIssue({
        code: 'custom',
        path: ['dateTo'],
        message: 'dateTo must be on or after dateFrom.',
      });
    }
  });

export const incidentIdParamSchema = z.object({ incidentId: z.uuid() }).strict();

export type ListAdminIncidentsQuery = z.infer<typeof listAdminIncidentsQuerySchema>;
export type IncidentIdParam = z.infer<typeof incidentIdParamSchema>;

export class AdminIncidentsZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The admin incident request is invalid.',
      });
    }
    return result.data;
  }
}
