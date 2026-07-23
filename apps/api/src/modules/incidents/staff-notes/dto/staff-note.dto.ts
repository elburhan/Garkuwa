import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

const body = z.string().trim().min(2).max(5000);
const reason = z.string().trim().min(10).max(1000);

export const createStaffNoteSchema = z.object({ body }).strict();
export const editStaffNoteSchema = z
  .object({
    body,
    reason: reason.optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const redactStaffNoteSchema = z
  .object({ reason, expectedVersion: z.number().int().positive() })
  .strict();
export const staffNoteParamsSchema = z.object({ incidentId: z.uuid(), noteId: z.uuid() }).strict();
export const listStaffNotesSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type CreateStaffNoteDto = z.infer<typeof createStaffNoteSchema>;
export type EditStaffNoteDto = z.infer<typeof editStaffNoteSchema>;
export type RedactStaffNoteDto = z.infer<typeof redactStaffNoteSchema>;
export type StaffNoteParams = z.infer<typeof staffNoteParamsSchema>;
export type ListStaffNotesQuery = z.infer<typeof listStaffNotesSchema>;

@Injectable()
export class StaffNoteZodPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}

  transform(value: unknown): unknown {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Staff-note request validation failed.',
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return parsed.data;
  }
}
