import { z } from 'zod';

import { IncidentStatus } from '../../../../generated/prisma/enums.js';

const expectedUpdatedAt = z.iso.datetime({ offset: true, precision: 3 });
const reason = z.string().trim().min(1).max(1000).optional();

export const updateIncidentStatusSchema = z
  .object({
    toStatus: z.enum(IncidentStatus),
    reason,
    expectedUpdatedAt,
  })
  .strict();

export const updateIncidentAssignmentSchema = z
  .object({
    assignedToUserId: z.uuid().nullable(),
    reason,
    expectedUpdatedAt,
  })
  .strict();

export type UpdateIncidentStatusDto = z.infer<typeof updateIncidentStatusSchema>;
export type UpdateIncidentAssignmentDto = z.infer<typeof updateIncidentAssignmentSchema>;
