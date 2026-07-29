import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export const publicNewsLanguageSchema = z.enum(['ha', 'en']);

export const publicNewsQuerySchema = z
  .object({
    lang: publicNewsLanguageSchema.default('ha'),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(30).default(10),
  })
  .strict();

export const publicNewsDetailParametersSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();

export const publicNewsDetailQuerySchema = z
  .object({
    lang: publicNewsLanguageSchema.default('ha'),
  })
  .strict();

export type PublicNewsLanguage = z.infer<typeof publicNewsLanguageSchema>;
export type PublicNewsQuery = z.infer<typeof publicNewsQuerySchema>;
export type PublicNewsDetailParameters = z.infer<typeof publicNewsDetailParametersSchema>;
export type PublicNewsDetailQuery = z.infer<typeof publicNewsDetailQuerySchema>;

export class PublicNewsZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The public news request is invalid.',
      });
    }
    return result.data;
  }
}
