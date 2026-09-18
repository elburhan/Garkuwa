import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export const staffEmailSchema = z.string().trim().toLowerCase().max(320).email();
export const staffPasswordSchema = z.string().min(12).max(128);

export const staffLoginSchema = z
  .object({
    email: staffEmailSchema,
    password: staffPasswordSchema,
  })
  .strict();

export type StaffLoginDto = z.infer<typeof staffLoginSchema>;

export class StaffAuthZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The authentication request is invalid.',
      });
    }
    return result.data;
  }
}
