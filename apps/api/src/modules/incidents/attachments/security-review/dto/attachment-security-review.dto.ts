import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

import { attachmentSecurityReviewDecisions } from '../attachment-security-review-policy.js';

const reasonSchema = z
  .string()
  .trim()
  .min(10, 'The review reason must contain at least 10 characters.')
  .max(1000, 'The review reason must contain at most 1000 characters.');

export const attachmentSecurityReviewSchema = z
  .object({
    decision: z.enum(attachmentSecurityReviewDecisions),
    reason: reasonSchema,
    expectedUpdatedAt: z.iso.datetime({ offset: true, precision: 3 }),
  })
  .strict();

export type AttachmentSecurityReviewDto = z.infer<typeof attachmentSecurityReviewSchema>;

@Injectable()
export class AttachmentSecurityReviewZodPipe implements PipeTransform {
  transform(value: unknown): AttachmentSecurityReviewDto {
    const result = attachmentSecurityReviewSchema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Attachment security review validation failed.',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
