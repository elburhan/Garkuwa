import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { ListAdminIncidentsQuery } from './dto/admin-incidents.dto.js';

export const adminIncidentQueueSelect = {
  id: true,
  internalCaseId: true,
  category: { select: { id: true, nameHa: true, nameEn: true } },
  status: true,
  severity: true,
  submissionLanguage: true,
  state: true,
  lga: true,
  locationDescription: true,
  incidentDate: true,
  submittedAt: true,
  assignedToUser: { select: { id: true, displayName: true } },
} as const satisfies Prisma.IncidentSelect;

export const adminIncidentDetailSelect = {
  id: true,
  internalCaseId: true,
  category: { select: { id: true, nameHa: true, nameEn: true } },
  description: true,
  incidentDate: true,
  incidentTime: true,
  locationDescription: true,
  state: true,
  lga: true,
  latitude: true,
  longitude: true,
  severity: true,
  status: true,
  submissionLanguage: true,
  assignedToUser: { select: { id: true, displayName: true } },
  duplicateOfIncidentId: true,
  submittedAt: true,
  updatedAt: true,
  closedAt: true,
  statusHistory: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      fromStatus: true,
      toStatus: true,
      createdAt: true,
      comment: true,
      changedByUser: { select: { id: true, displayName: true } },
    },
  },
  assignmentHistory: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      comment: true,
      createdAt: true,
      fromUser: { select: { id: true, displayName: true } },
      toUser: { select: { id: true, displayName: true } },
      changedByUser: { select: { id: true, displayName: true } },
    },
  },
} as const satisfies Prisma.IncidentSelect;

function startOfDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayAfter(value: string): Date {
  const date = startOfDate(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function buildWhere(query: ListAdminIncidentsQuery): Prisma.IncidentWhereInput {
  return {
    ...(query.status && { status: query.status }),
    ...(query.severity && { severity: query.severity }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.submissionLanguage && { submissionLanguage: query.submissionLanguage }),
    ...(query.state && { state: { equals: query.state, mode: 'insensitive' } }),
    ...(query.lga && { lga: { equals: query.lga, mode: 'insensitive' } }),
    ...((query.dateFrom || query.dateTo) && {
      submittedAt: {
        ...(query.dateFrom && { gte: startOfDate(query.dateFrom) }),
        ...(query.dateTo && { lt: dayAfter(query.dateTo) }),
      },
    }),
    ...(query.search && {
      OR: [
        { internalCaseId: { contains: query.search, mode: 'insensitive' } },
        { state: { contains: query.search, mode: 'insensitive' } },
        { lga: { contains: query.search, mode: 'insensitive' } },
        { locationDescription: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };
}

function buildOrderBy(query: ListAdminIncidentsQuery): Prisma.IncidentOrderByWithRelationInput[] {
  const primary: Prisma.IncidentOrderByWithRelationInput =
    query.sort === 'oldest'
      ? { submittedAt: 'asc' }
      : query.sort === 'severity'
        ? { severity: 'desc' }
        : query.sort === 'status'
          ? { status: 'asc' }
          : { submittedAt: 'desc' };
  return [primary, { id: 'asc' }];
}

@Injectable()
export class AdminIncidentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListAdminIncidentsQuery) {
    const where = buildWhere(query);
    const [rows, totalItems] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        select: adminIncidentQueueSelect,
        orderBy: buildOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      items: rows.map(({ assignedToUser, ...incident }) => ({
        ...incident,
        incidentDate: incident.incidentDate?.toISOString() ?? null,
        submittedAt: incident.submittedAt.toISOString(),
        assignedTo: assignedToUser,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async detail(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: adminIncidentDetailSelect,
    });
    if (!incident) throw new NotFoundException('Incident not found.');

    const { assignedToUser, statusHistory, assignmentHistory, ...details } = incident;
    return {
      incident: {
        ...details,
        incidentDate: incident.incidentDate?.toISOString() ?? null,
        incidentTime: incident.incidentTime?.toISOString() ?? null,
        latitude: incident.latitude?.toString() ?? null,
        longitude: incident.longitude?.toString() ?? null,
        submittedAt: incident.submittedAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
        closedAt: incident.closedAt?.toISOString() ?? null,
        assignedTo: assignedToUser,
        statusHistory: statusHistory.map((history) => ({
          fromStatus: history.fromStatus,
          toStatus: history.toStatus,
          changedAt: history.createdAt.toISOString(),
          changedBy: history.changedByUser,
          comment: history.comment,
        })),
        assignmentHistory: assignmentHistory.map((history) => ({
          fromUser: history.fromUser,
          toUser: history.toUser,
          changedBy: history.changedByUser,
          comment: history.comment,
          changedAt: history.createdAt.toISOString(),
        })),
      },
    };
  }
}
