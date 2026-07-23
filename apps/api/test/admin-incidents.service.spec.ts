import { NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import {
  adminIncidentDetailSelect,
  adminIncidentQueueSelect,
  AdminIncidentsService,
} from '../src/modules/incidents/admin/admin-incidents.service.js';
import type { ListAdminIncidentsQuery } from '../src/modules/incidents/admin/dto/admin-incidents.dto.js';

const submittedAt = new Date('2026-07-22T12:00:00.000Z');
const incidentDate = new Date('2026-07-21T00:00:00.000Z');
const queueRow = {
  id: '52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
  internalCaseId: 'GAR-20260722-0001',
  category: {
    id: 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0',
    nameHa: 'Tsaro',
    nameEn: 'Safety',
  },
  status: 'NEW',
  severity: 'MEDIUM',
  submissionLanguage: 'ha',
  state: 'Kano',
  lga: 'Nassarawa',
  locationDescription: 'Wurin gwaji',
  incidentDate,
  submittedAt,
  assignedToUser: null,
};

const defaultQuery: ListAdminIncidentsQuery = {
  page: 1,
  pageSize: 20,
  sort: 'newest',
};

describe('AdminIncidentsService', () => {
  const findMany = jest.fn<(input: unknown) => Promise<(typeof queueRow)[]>>();
  const count = jest.fn<() => Promise<number>>();
  const findUnique = jest.fn<(input: unknown) => Promise<unknown>>();
  const prisma = {
    incident: { findMany, count, findUnique },
  } as unknown as PrismaService;
  const service = new AdminIncidentsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([queueRow]);
    count.mockResolvedValue(21);
  });

  it('uses explicit contact-free selection, deterministic sorting, and pagination totals', async () => {
    const result = await service.list(defaultQuery);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: adminIncidentQueueSelect,
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
        skip: 0,
        take: 20,
      }),
    );
    expect(JSON.stringify(adminIncidentQueueSelect)).not.toContain('contact');
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 21,
      totalPages: 2,
    });
    expect(result.items[0]).not.toHaveProperty('description');
    expect(result.items[0]).not.toHaveProperty('assignedToUser');
  });

  it('translates only approved filters and safe search fields into Prisma', async () => {
    await service.list({
      page: 2,
      pageSize: 10,
      sort: 'oldest',
      status: 'UNDER_REVIEW',
      severity: 'HIGH',
      categoryId: 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0',
      submissionLanguage: 'en',
      state: 'Kaduna',
      lga: 'Chikun',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-22',
      search: 'GAR-2026',
    });
    const call = findMany.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.skip).toBe(10);
    expect(call.orderBy).toEqual([{ submittedAt: 'asc' }, { id: 'asc' }]);
    expect(JSON.stringify(call.where)).toContain('internalCaseId');
    expect(JSON.stringify(call.where)).toContain('locationDescription');
    expect(JSON.stringify(call.where)).not.toContain('description');
    expect(JSON.stringify(call.where)).not.toContain('contact');
  });

  it('returns description only from detail with ordered minimal history selection', async () => {
    findUnique.mockResolvedValue({
      ...queueRow,
      description: 'First paragraph.\n\nSecond paragraph.',
      incidentTime: null,
      latitude: null,
      longitude: null,
      duplicateOfIncidentId: null,
      updatedAt: submittedAt,
      closedAt: null,
      assignedToUser: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: 'NEW',
          createdAt: submittedAt,
          comment: null,
          changedByUser: null,
        },
      ],
    });

    const result = await service.detail(queueRow.id);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: queueRow.id },
      select: adminIncidentDetailSelect,
    });
    expect(JSON.stringify(adminIncidentDetailSelect)).not.toContain('contact');
    expect(adminIncidentDetailSelect.statusHistory.orderBy).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
    expect(result.incident.description).toContain('\n\n');
    expect(result.incident.statusHistory[0]?.changedBy).toBeNull();
    expect(result.incident.statusHistory[0]).not.toHaveProperty('changedByUser');
  });

  it('returns a safe 404 for a missing incident', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.detail(queueRow.id)).rejects.toEqual(
      new NotFoundException('Incident not found.'),
    );
  });
});
