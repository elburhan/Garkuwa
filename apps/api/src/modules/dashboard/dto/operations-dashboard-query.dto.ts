import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export const operationsDashboardRanges = ['7d', '30d', '90d'] as const;
export type OperationsDashboardRange = (typeof operationsDashboardRanges)[number];

export const operationsDashboardQuerySchema = z
  .object({
    range: z.enum(operationsDashboardRanges).default('30d'),
  })
  .strict();

export type OperationsDashboardQuery = z.infer<typeof operationsDashboardQuerySchema>;

export class OperationsDashboardQueryPipe implements PipeTransform<
  unknown,
  OperationsDashboardQuery
> {
  transform(value: unknown): OperationsDashboardQuery {
    const result = operationsDashboardQuerySchema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The dashboard range is invalid.',
      });
    }
    return result.data;
  }
}
