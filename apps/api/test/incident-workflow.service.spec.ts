import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import { IncidentStatus, StaffRole, UserStatus } from '../src/generated/prisma/enums.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import { IncidentWorkflowService } from '../src/modules/incidents/workflow/incident-workflow.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const actor: StaffPrincipal = {
  id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
  email: 'moderator@example.test',
  name: 'Moderator',
  role: StaffRole.MODERATOR,
};
const expectedUpdatedAt = new Date('2026-07-23T12:00:00.000Z');
const changedAt = new Date('2026-07-23T12:05:00.000Z');
const baseIncident = {
  id: incidentId,
  internalCaseId: 'GAR-20260723-0001',
  status: IncidentStatus.NEW,
  assignedToUserId: null,
  updatedAt: expectedUpdatedAt,
};

describe('IncidentWorkflowService', () => {
  const incidentFindUnique = jest.fn<(input: unknown) => Promise<unknown>>();
  const incidentUpdateMany = jest.fn<(input: unknown) => Promise<{ count: number }>>();
  const statusHistoryCreate = jest.fn<(input: unknown) => Promise<unknown>>();
  const assignmentHistoryCreate = jest.fn<(input: unknown) => Promise<unknown>>();
  const userFindFirst = jest.fn<(input: unknown) => Promise<unknown>>();
  const userFindMany = jest.fn<(input: unknown) => Promise<unknown[]>>();
  const transactionClient = {
    incident: { findUnique: incidentFindUnique, updateMany: incidentUpdateMany },
    incidentStatusHistory: { create: statusHistoryCreate },
    incidentAssignmentHistory: { create: assignmentHistoryCreate },
    user: { findFirst: userFindFirst },
  };
  const transaction = jest.fn(async (callback: (client: typeof transactionClient) => unknown) =>
    callback(transactionClient),
  );
  const prisma = {
    $transaction: transaction,
    user: { findMany: userFindMany },
  } as unknown as PrismaService;
  const service = new IncidentWorkflowService(prisma, () => changedAt.getTime());

  beforeEach(() => {
    jest.clearAllMocks();
    incidentFindUnique.mockResolvedValue({ ...baseIncident });
    incidentUpdateMany.mockResolvedValue({ count: 1 });
    statusHistoryCreate.mockResolvedValue({
      fromStatus: 'NEW',
      toStatus: 'UNDER_REVIEW',
      comment: null,
      createdAt: changedAt,
      changedByUser: { id: actor.id, displayName: actor.name },
    });
    assignmentHistoryCreate.mockResolvedValue({ id: 'history-id' });
    userFindFirst.mockResolvedValue({
      id: actor.id,
      displayName: actor.name,
      role: StaffRole.MODERATOR,
    });
  });

  it('atomically updates status and creates actor-attributed history', async () => {
    const result = await service.updateStatus(
      incidentId,
      {
        toStatus: IncidentStatus.UNDER_REVIEW,
        expectedUpdatedAt: expectedUpdatedAt.toISOString(),
      },
      actor,
    );
    expect(incidentUpdateMany).toHaveBeenCalledWith({
      where: { id: incidentId, updatedAt: expectedUpdatedAt },
      data: {
        status: IncidentStatus.UNDER_REVIEW,
        updatedAt: changedAt,
      },
    });
    expect(statusHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId,
          fromStatus: IncidentStatus.NEW,
          toStatus: IncidentStatus.UNDER_REVIEW,
          changedByUserId: actor.id,
        }),
      }),
    );
    expect(result.incident.updatedAt).toBe(changedAt.toISOString());
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('sets closedAt when closing and clears it when reopening', async () => {
    incidentFindUnique.mockResolvedValueOnce({
      ...baseIncident,
      status: IncidentStatus.ACTIONED,
    });
    await service.updateStatus(
      incidentId,
      { toStatus: IncidentStatus.CLOSED, expectedUpdatedAt: expectedUpdatedAt.toISOString() },
      actor,
    );
    expect(incidentUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ closedAt: changedAt }) }),
    );

    incidentFindUnique.mockResolvedValueOnce({
      ...baseIncident,
      status: IncidentStatus.CLOSED,
    });
    await service.updateStatus(
      incidentId,
      {
        toStatus: IncidentStatus.UNDER_REVIEW,
        reason: 'Reviewed again',
        expectedUpdatedAt: expectedUpdatedAt.toISOString(),
      },
      actor,
    );
    expect(incidentUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ closedAt: null }) }),
    );
  });

  it('rejects invalid transitions and required-reason omissions before writing', async () => {
    await expect(
      service.updateStatus(
        incidentId,
        { toStatus: IncidentStatus.CLOSED, expectedUpdatedAt: expectedUpdatedAt.toISOString() },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(incidentUpdateMany).not.toHaveBeenCalled();

    await expect(
      service.updateStatus(
        incidentId,
        { toStatus: IncidentStatus.REJECTED, expectedUpdatedAt: expectedUpdatedAt.toISOString() },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns conflict for stale reads and conditional-update races', async () => {
    incidentFindUnique.mockResolvedValueOnce({
      ...baseIncident,
      updatedAt: new Date('2026-07-23T12:00:01.000Z'),
    });
    await expect(
      service.updateStatus(
        incidentId,
        {
          toStatus: IncidentStatus.UNDER_REVIEW,
          expectedUpdatedAt: expectedUpdatedAt.toISOString(),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    incidentUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.updateStatus(
        incidentId,
        {
          toStatus: IncidentStatus.UNDER_REVIEW,
          expectedUpdatedAt: expectedUpdatedAt.toISOString(),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(statusHistoryCreate).not.toHaveBeenCalled();
  });

  it('advances the millisecond version even when the clock has not advanced', async () => {
    const sameMillisecondService = new IncidentWorkflowService(prisma, () =>
      expectedUpdatedAt.getTime(),
    );
    statusHistoryCreate.mockResolvedValueOnce({
      fromStatus: 'NEW',
      toStatus: 'UNDER_REVIEW',
      comment: null,
      createdAt: new Date(expectedUpdatedAt.getTime() + 1),
      changedByUser: { id: actor.id, displayName: actor.name },
    });
    await sameMillisecondService.updateStatus(
      incidentId,
      {
        toStatus: IncidentStatus.UNDER_REVIEW,
        expectedUpdatedAt: expectedUpdatedAt.toISOString(),
      },
      actor,
    );
    expect(incidentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          updatedAt: new Date(expectedUpdatedAt.getTime() + 1),
        }),
      }),
    );
  });

  it('assigns eligible staff and creates assignment history atomically', async () => {
    const result = await service.updateAssignment(
      incidentId,
      {
        assignedToUserId: actor.id,
        reason: 'Initial allocation',
        expectedUpdatedAt: expectedUpdatedAt.toISOString(),
      },
      actor,
    );
    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        id: actor.id,
        status: UserStatus.ACTIVE,
        role: { in: [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR] },
      },
      select: { id: true, displayName: true, role: true },
    });
    expect(assignmentHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromUserId: null,
          toUserId: actor.id,
          changedByUserId: actor.id,
          comment: 'Initial allocation',
        }),
      }),
    );
    expect(result.incident.assignedTo?.role).toBe(StaffRole.MODERATOR);
  });

  it('supports unassignment and rejects unchanged or ineligible assignments', async () => {
    incidentFindUnique.mockResolvedValueOnce({ ...baseIncident, assignedToUserId: actor.id });
    await service.updateAssignment(
      incidentId,
      { assignedToUserId: null, expectedUpdatedAt: expectedUpdatedAt.toISOString() },
      actor,
    );
    expect(assignmentHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromUserId: actor.id, toUserId: null }),
      }),
    );

    await expect(
      service.updateAssignment(
        incidentId,
        { assignedToUserId: null, expectedUpdatedAt: expectedUpdatedAt.toISOString() },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    userFindFirst.mockResolvedValueOnce(null);
    await expect(
      service.updateAssignment(
        incidentId,
        { assignedToUserId: actor.id, expectedUpdatedAt: expectedUpdatedAt.toISOString() },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns only active eligible assignees with deterministic bounded selection', async () => {
    userFindMany.mockResolvedValue([]);
    await expect(service.eligibleAssignees()).resolves.toEqual({ users: [] });
    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        status: UserStatus.ACTIVE,
        role: { in: [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR] },
      },
      select: { id: true, displayName: true, email: true, role: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: 500,
    });
  });

  it('propagates history failures so the transaction can roll back', async () => {
    statusHistoryCreate.mockRejectedValueOnce(new Error('history failure'));
    await expect(
      service.updateStatus(
        incidentId,
        {
          toStatus: IncidentStatus.UNDER_REVIEW,
          expectedUpdatedAt: expectedUpdatedAt.toISOString(),
        },
        actor,
      ),
    ).rejects.toThrow('history failure');
  });

  it('prevents stale assignment writes and propagates assignment-history failures', async () => {
    incidentFindUnique.mockResolvedValueOnce({
      ...baseIncident,
      updatedAt: new Date('2026-07-23T12:00:01.000Z'),
    });
    await expect(
      service.updateAssignment(
        incidentId,
        { assignedToUserId: actor.id, expectedUpdatedAt: expectedUpdatedAt.toISOString() },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(incidentUpdateMany).not.toHaveBeenCalled();

    assignmentHistoryCreate.mockRejectedValueOnce(new Error('history failure'));
    await expect(
      service.updateAssignment(
        incidentId,
        { assignedToUserId: actor.id, expectedUpdatedAt: expectedUpdatedAt.toISOString() },
        actor,
      ),
    ).rejects.toThrow('history failure');
  });
});
