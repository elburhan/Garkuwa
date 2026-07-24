import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  AttachmentStatus,
  IncidentSeverity,
  IncidentStatus,
  StaffRole,
  UserStatus,
} from '../../generated/prisma/enums.js';
import type {
  OperationsDashboardQuery,
  OperationsDashboardRange,
} from './dto/operations-dashboard-query.dto.js';

export const OPERATIONS_DASHBOARD_CLOCK = Symbol('OPERATIONS_DASHBOARD_CLOCK');
export type OperationsDashboardClock = () => number;

const statusOrder = [
  IncidentStatus.NEW,
  IncidentStatus.UNDER_REVIEW,
  IncidentStatus.ACTIONED,
  IncidentStatus.CLOSED,
  IncidentStatus.REJECTED,
] as const;
const severityOrder = [
  IncidentSeverity.LOW,
  IncidentSeverity.MEDIUM,
  IncidentSeverity.HIGH,
] as const;
const openStatuses = [
  IncidentStatus.NEW,
  IncidentStatus.UNDER_REVIEW,
  IncidentStatus.ACTIONED,
] as const;
const eligibleAssigneeRoles = [
  StaffRole.SUPER_ADMIN,
  StaffRole.ADMIN,
  StaffRole.MODERATOR,
] as const;
const rangeDays: Readonly<Record<OperationsDashboardRange, number>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

interface DailySubmissionCount {
  date: Date | string;
  count: bigint;
}

interface ActivityItem {
  sourceId: string;
  type: 'INCIDENT_SUBMITTED' | 'STATUS_CHANGED' | 'ASSIGNMENT_CHANGED' | 'ATTACHMENT_REVIEWED';
  occurredAt: Date;
  incident: { id: string; internalCaseId: string };
  actor: { id: string; displayName: string } | null;
  summary: {
    fromStatus?: IncidentStatus | null;
    toStatus?: IncidentStatus | null;
    fromAssigneeDisplayName?: string | null;
    toAssigneeDisplayName?: string | null;
    attachmentDecision?: AttachmentStatus;
  };
}

export function calculateDashboardRange(
  key: OperationsDashboardRange,
  now: Date,
): { from: Date; to: Date; dates: string[] } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - (rangeDays[key] - 1));
  const dates = Array.from({ length: rangeDays[key] }, (_, index) => {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  return { from, to: now, dates };
}

@Injectable()
export class AdminOperationsDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OPERATIONS_DASHBOARD_CLOCK)
    private readonly clock: OperationsDashboardClock,
  ) {}

  async operations(query: OperationsDashboardQuery) {
    const now = new Date(this.clock());
    const range = calculateDashboardRange(query.range, now);
    const activityWhere = { gte: range.from, lte: range.to };

    const [
      statusGroups,
      severityGroups,
      unassignedIncidents,
      attachmentGroups,
      eligibleStaff,
      dailyCounts,
      submittedActivity,
      statusActivity,
      assignmentActivity,
      attachmentActivity,
    ] = await Promise.all([
      this.prisma.incident.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.incident.groupBy({
        by: ['severity'],
        _count: { id: true },
      }),
      this.prisma.incident.count({
        where: {
          assignedToUserId: null,
          status: { in: [...openStatuses] },
        },
      }),
      this.prisma.incidentAttachment.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          role: { in: [...eligibleAssigneeRoles] },
        },
        select: { id: true, displayName: true },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        take: 500,
      }),
      this.prisma.$queryRaw<DailySubmissionCount[]>(Prisma.sql`
        SELECT DATE("submitted_at" AT TIME ZONE 'UTC') AS "date",
               COUNT(*)::bigint AS "count"
        FROM "incidents"
        WHERE "submitted_at" >= ${range.from}
          AND "submitted_at" <= ${range.to}
        GROUP BY DATE("submitted_at" AT TIME ZONE 'UTC')
        ORDER BY "date" ASC
      `),
      this.prisma.incident.findMany({
        where: { submittedAt: activityWhere },
        select: { id: true, internalCaseId: true, submittedAt: true },
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
        take: 20,
      }),
      this.prisma.incidentStatusHistory.findMany({
        where: { createdAt: activityWhere, fromStatus: { not: null } },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          createdAt: true,
          incident: { select: { id: true, internalCaseId: true } },
          changedByUser: { select: { id: true, displayName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 20,
      }),
      this.prisma.incidentAssignmentHistory.findMany({
        where: { createdAt: activityWhere },
        select: {
          id: true,
          createdAt: true,
          incident: { select: { id: true, internalCaseId: true } },
          changedByUser: { select: { id: true, displayName: true } },
          fromUser: { select: { displayName: true } },
          toUser: { select: { displayName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 20,
      }),
      this.prisma.incidentAttachmentSecurityReview.findMany({
        where: { createdAt: activityWhere },
        select: {
          id: true,
          decision: true,
          createdAt: true,
          incident: { select: { id: true, internalCaseId: true } },
          reviewedBy: { select: { id: true, displayName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 20,
      }),
    ]);

    const eligibleIds = eligibleStaff.map((staff) => staff.id);
    const assignmentGroups = eligibleIds.length
      ? await this.prisma.incident.groupBy({
          by: ['assignedToUserId'],
          where: {
            assignedToUserId: { in: eligibleIds },
            status: { in: [...openStatuses] },
          },
          _count: { id: true },
        })
      : [];

    const statusCounts = new Map(statusGroups.map((row) => [row.status, row._count.id]));
    const severityCounts = new Map(severityGroups.map((row) => [row.severity, row._count.id]));
    const attachmentCounts = new Map(attachmentGroups.map((row) => [row.status, row._count.id]));
    const assignmentCounts = new Map(
      assignmentGroups.map((row) => [row.assignedToUserId, row._count.id]),
    );
    const totalIncidents = statusOrder.reduce(
      (total, status) => total + (statusCounts.get(status) ?? 0),
      0,
    );
    const trendCounts = new Map(
      dailyCounts.map((row) => [
        typeof row.date === 'string' ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10),
        Number(row.count),
      ]),
    );

    const activity: ActivityItem[] = [
      ...submittedActivity.map((row) => ({
        sourceId: row.id,
        type: 'INCIDENT_SUBMITTED' as const,
        occurredAt: row.submittedAt,
        incident: { id: row.id, internalCaseId: row.internalCaseId },
        actor: null,
        summary: {},
      })),
      ...statusActivity.map((row) => ({
        sourceId: row.id,
        type: 'STATUS_CHANGED' as const,
        occurredAt: row.createdAt,
        incident: row.incident,
        actor: row.changedByUser,
        summary: { fromStatus: row.fromStatus, toStatus: row.toStatus },
      })),
      ...assignmentActivity.map((row) => ({
        sourceId: row.id,
        type: 'ASSIGNMENT_CHANGED' as const,
        occurredAt: row.createdAt,
        incident: row.incident,
        actor: row.changedByUser,
        summary: {
          fromAssigneeDisplayName: row.fromUser?.displayName ?? null,
          toAssigneeDisplayName: row.toUser?.displayName ?? null,
        },
      })),
      ...attachmentActivity.map((row) => ({
        sourceId: row.id,
        type: 'ATTACHMENT_REVIEWED' as const,
        occurredAt: row.createdAt,
        incident: row.incident,
        actor: row.reviewedBy,
        summary: { attachmentDecision: row.decision },
      })),
    ];
    activity.sort(
      (left, right) =>
        right.occurredAt.getTime() - left.occurredAt.getTime() ||
        left.type.localeCompare(right.type) ||
        left.sourceId.localeCompare(right.sourceId),
    );

    return {
      generatedAt: now.toISOString(),
      range: {
        key: query.range,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      overview: {
        totalIncidents,
        newIncidents: statusCounts.get(IncidentStatus.NEW) ?? 0,
        underReviewIncidents: statusCounts.get(IncidentStatus.UNDER_REVIEW) ?? 0,
        unassignedIncidents,
        openIncidents: openStatuses.reduce(
          (total, status) => total + (statusCounts.get(status) ?? 0),
          0,
        ),
        closedIncidents: statusCounts.get(IncidentStatus.CLOSED) ?? 0,
        rejectedIncidents: statusCounts.get(IncidentStatus.REJECTED) ?? 0,
      },
      statusDistribution: statusOrder.map((status) => ({
        status,
        count: statusCounts.get(status) ?? 0,
      })),
      severityDistribution: severityOrder.map((severity) => ({
        severity,
        count: severityCounts.get(severity) ?? 0,
      })),
      submissionTrend: range.dates.map((date) => ({
        date,
        count: trendCounts.get(date) ?? 0,
      })),
      assignmentWorkload: eligibleStaff
        .map((staff) => ({
          staff,
          activeIncidentCount: assignmentCounts.get(staff.id) ?? 0,
        }))
        .sort(
          (left, right) =>
            right.activeIncidentCount - left.activeIncidentCount ||
            left.staff.displayName.localeCompare(right.staff.displayName) ||
            left.staff.id.localeCompare(right.staff.id),
        )
        .slice(0, 50),
      attachmentReviewWorkload: {
        quarantined: attachmentCounts.get(AttachmentStatus.QUARANTINED) ?? 0,
        available: attachmentCounts.get(AttachmentStatus.AVAILABLE) ?? 0,
        rejected: attachmentCounts.get(AttachmentStatus.REJECTED) ?? 0,
      },
      recentActivity: activity.slice(0, 20).map((item) => ({
        type: item.type,
        occurredAt: item.occurredAt.toISOString(),
        incident: item.incident,
        actor: item.actor,
        summary: item.summary,
      })),
    };
  }
}
