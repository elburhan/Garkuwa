import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export const contactAccessRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, 'Access reason must contain at least 10 characters.')
      .max(1000),
  })
  .strict();

export type ContactAccessRequestDto = z.infer<typeof contactAccessRequestSchema>;

@Injectable()
export class ContactAccessZodPipe implements PipeTransform {
  transform(value: unknown): ContactAccessRequestDto {
    const parsed = contactAccessRequestSchema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Contact-access request validation failed.',
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return parsed.data;
  }
}
