import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

import {
  IncidentSeverity,
  PreferredContactMethod,
  SubmissionLanguage,
} from '../../../generated/prisma/enums.js';

const optionalText = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength).optional();

const strictDate = /^\d{4}-\d{2}-\d{2}$/;
const strictTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const phoneNumber = /^\+?[0-9](?:[0-9 ()-]{5,22}[0-9])$/;

function isCalendarDate(value: string): boolean {
  if (!strictDate.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month! - 1 &&
    parsed.getUTCDate() === day
  );
}

export const incidentContactSchema = z
  .object({
    name: optionalText(160),
    phone: z.string().trim().max(32).regex(phoneNumber, 'Phone number is invalid.').optional(),
    email: z.string().trim().max(320).email('Email address is invalid.').optional(),
    preferredContactMethod: z.enum(PreferredContactMethod),
    safeContactInstructions: optionalText(500),
    consentToContact: z.literal(true, {
      error: 'Consent is required before follow-up contact details can be stored.',
    }),
  })
  .strict()
  .superRefine((contact, context) => {
    if (!contact.phone && !contact.email) {
      context.addIssue({
        code: 'custom',
        message: 'Provide a phone number or email address for follow-up.',
        path: ['phone'],
      });
    }

    if (contact.preferredContactMethod === PreferredContactMethod.PHONE && !contact.phone) {
      context.addIssue({
        code: 'custom',
        message: 'A phone number is required when PHONE is preferred.',
        path: ['phone'],
      });
    }

    if (contact.preferredContactMethod === PreferredContactMethod.EMAIL && !contact.email) {
      context.addIssue({
        code: 'custom',
        message: 'An email address is required when EMAIL is preferred.',
        path: ['email'],
      });
    }
  });

export const createIncidentSchema = z
  .object({
    categoryId: z.uuid(),
    description: z.string().trim().min(20).max(5000),
    incidentDate: z
      .string()
      .refine(isCalendarDate, 'Use a valid date in YYYY-MM-DD format.')
      .optional(),
    incidentTime: z.string().regex(strictTime, 'Use a valid time in HH:mm format.').optional(),
    locationDescription: optionalText(500),
    state: optionalText(100),
    lga: optionalText(100),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    severity: z.enum(IncidentSeverity),
    submissionLanguage: z.enum(SubmissionLanguage),
    contact: incidentContactSchema.optional(),
  })
  .strict()
  .superRefine((incident, context) => {
    if ((incident.latitude === undefined) !== (incident.longitude === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'Latitude and longitude must be provided together.',
        path: ['latitude'],
      });
    }
  });

export type CreateIncidentDto = z.infer<typeof createIncidentSchema>;

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The incident submission is invalid.',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}
