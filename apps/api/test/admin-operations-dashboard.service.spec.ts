import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import {
  AttachmentStatus,
  IncidentSeverity,
  IncidentStatus,
} from '../src/generated/prisma/enums.js';
import { AdminOperationsDashboardService } from '../src/modules/dashboard/admin-operations-dashboard.service.js';

const now = new Date('2026-07-24T08:00:00.000Z');
const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const actorId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';

describe('AdminOperationsDashboardService', () => {
  const incidentGroupBy = jest.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();
  const incidentCount = jest.fn<(...arguments_: unknown[]) => Promise<number>>();
  const incidentFindMany = jest.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();
  const attachmentGroupBy = jest.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();
  const userFindMany = jest.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();
  const statusFindMany = jest.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();
  const assignmentFindMany = jest.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();
  const reviewFindMany = jest.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();
  const queryRaw = jest.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();
  const prisma = {
    incident: {
      groupBy: incidentGroupBy,
      count: incidentCount,
      findMany: incidentFindMany,
    },
    incidentAttachment: { groupBy: attachmentGroupBy },
    user: { findMany: userFindMany },
    incidentStatusHistory: { findMany: statusFindMany },
    incidentAssignmentHistory: { findMany: assignmentFindMany },
    incidentAttachmentSecurityReview: { findMany: reviewFindMany },
    $queryRaw: queryRaw,
  } as unknown as PrismaService;
  const service = new AdminOperationsDashboardService(prisma, () => now.getTime());

  beforeEach(() => {
    jest.clearAllMocks();
    incidentGroupBy
      .mockResolvedValueOnce([
        { status: IncidentStatus.NEW, _count: { id: 2 } },
        { status: IncidentStatus.UNDER_REVIEW, _count: { id: 3 } },
        { status: IncidentStatus.CLOSED, _count: { id: 1 } },
        { status: IncidentStatus.REJECTED, _count: { id: 1 } },
      ])
      .mockResolvedValueOnce([
        { severity: IncidentSeverity.LOW, _count: { id: 4 } },
        { severity: IncidentSeverity.HIGH, _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([{ assignedToUserId: actorId, _count: { id: 3 } }]);
    incidentCount.mockResolvedValue(2);
    attachmentGroupBy.mockResolvedValue([
      { status: AttachmentStatus.QUARANTINED, _count: { id: 4 } },
      { status: AttachmentStatus.AVAILABLE, _count: { id: 2 } },
    ]);
    userFindMany.mockResolvedValue([
      { id: actorId, displayName: 'Amina' },
      {
        id: 'e614cb87-d213-47b4-8f81-779138bf89b5',
        displayName: 'Usman',
      },
    ]);
    queryRaw.mockResolvedValue([
      { date: new Date('2026-07-23T00:00:00.000Z'), count: 2n },
      { date: new Date('2026-07-24T00:00:00.000Z'), count: 1n },
    ]);
    incidentFindMany.mockResolvedValue([
      {
        id: incidentId,
        internalCaseId: 'GAR-20260724-0001',
        submittedAt: new Date('2026-07-24T07:00:00.000Z'),
      },
    ]);
    statusFindMany.mockResolvedValue([
      {
        id: 'b5a9ce8b-b44a-40a6-9854-dfb940ad3931',
        fromStatus: IncidentStatus.NEW,
        toStatus: IncidentStatus.UNDER_REVIEW,
        createdAt: new Date('2026-07-24T07:30:00.000Z'),
        incident: { id: incidentId, internalCaseId: 'GAR-20260724-0001' },
        changedByUser: { id: actorId, displayName: 'Amina' },
      },
    ]);
    assignmentFindMany.mockResolvedValue([]);
    reviewFindMany.mockResolvedValue([
      {
        id: 'f95c4543-6f33-444f-81d7-a08d0104f9e1',
        decision: AttachmentStatus.AVAILABLE,
        createdAt: new Date('2026-07-24T07:45:00.000Z'),
        incident: { id: incidentId, internalCaseId: 'GAR-20260724-0001' },
        reviewedBy: { id: actorId, displayName: 'Amina' },
      },
    ]);
  });

  it('returns complete deterministic privacy-safe aggregates and zero buckets', async () => {
    const result = await service.operations({ range: '7d' });
    expect(result.overview).toEqual({
      totalIncidents: 7,
      newIncidents: 2,
      underReviewIncidents: 3,
      unassignedIncidents: 2,
      openIncidents: 5,
      closedIncidents: 1,
      rejectedIncidents: 1,
    });
    expect(result.statusDistribution).toEqual([
      { status: 'NEW', count: 2 },
      { status: 'UNDER_REVIEW', count: 3 },
      { status: 'ACTIONED', count: 0 },
      { status: 'CLOSED', count: 1 },
      { status: 'REJECTED', count: 1 },
    ]);
    expect(result.severityDistribution).toEqual([
      { severity: 'LOW', count: 4 },
      { severity: 'MEDIUM', count: 0 },
      { severity: 'HIGH', count: 3 },
    ]);
    expect(result.submissionTrend).toHaveLength(7);
    expect(result.submissionTrend.at(-2)).toEqual({
      date: '2026-07-23',
      count: 2,
    });
    expect(result.submissionTrend[0]).toEqual({
      date: '2026-07-18',
      count: 0,
    });
    expect(result.assignmentWorkload).toEqual([
      {
        staff: { id: actorId, displayName: 'Amina' },
        activeIncidentCount: 3,
      },
      {
        staff: {
          id: 'e614cb87-d213-47b4-8f81-779138bf89b5',
          displayName: 'Usman',
        },
        activeIncidentCount: 0,
      },
    ]);
    expect(result.attachmentReviewWorkload).toEqual({
      quarantined: 4,
      available: 2,
      rejected: 0,
    });
    expect(result.recentActivity.map((item) => item.type)).toEqual([
      'ATTACHMENT_REVIEWED',
      'STATUS_CHANGED',
      'INCIDENT_SUBMITTED',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /description|coordinates|contact|filename|objectKey|sha256|reason|password|session/i,
    );
  });

  it('uses bounded minimal queries and approved current-workload definitions', async () => {
    await service.operations({ range: '30d' });
    expect(incidentCount).toHaveBeenCalledWith({
      where: {
        assignedToUserId: null,
        status: {
          in: ['NEW', 'UNDER_REVIEW', 'ACTIONED'],
        },
      },
    });
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, displayName: true },
        take: 500,
      }),
    );
    for (const mock of [incidentFindMany, statusFindMany, assignmentFindMany, reviewFindMany]) {
      expect(mock).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
    }
    const serializedCalls = JSON.stringify({
      incidents: incidentFindMany.mock.calls,
      statuses: statusFindMany.mock.calls,
      assignments: assignmentFindMany.mock.calls,
      reviews: reviewFindMany.mock.calls,
      staff: userFindMany.mock.calls,
    });
    expect(serializedCalls).not.toMatch(
      /description|latitude|longitude|contact|body|reason|filename|objectKey|sha256|email|password|session/i,
    );
  });
});
