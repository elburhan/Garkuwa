import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import { StaffRole } from '../src/generated/prisma/enums.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import { IncidentStaffNotesService } from '../src/modules/incidents/staff-notes/incident-staff-notes.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const noteId = 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0';
const authorId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const createdAt = new Date('2026-07-23T14:00:00.000Z');
const now = new Date('2026-07-23T14:10:00.000Z');
const moderator: StaffPrincipal = {
  id: authorId,
  email: 'moderator@example.test',
  name: 'Moderator',
  role: StaffRole.MODERATOR,
};
const admin: StaffPrincipal = {
  ...moderator,
  id: '7915f2ef-67da-45ac-b577-5d5c573afca5',
  role: StaffRole.ADMIN,
};

describe('IncidentStaffNotesService', () => {
  const incidentFindUnique = jest.fn<(input: unknown) => Promise<unknown>>();
  const noteCreate = jest.fn<(input: unknown) => Promise<unknown>>();
  const noteFindFirst = jest.fn<(input: unknown) => Promise<unknown>>();
  const noteUpdateMany = jest.fn<(input: unknown) => Promise<{ count: number }>>();
  const revisionCreate = jest.fn<(input: unknown) => Promise<unknown>>();
  const transactionClient = {
    incident: { findUnique: incidentFindUnique },
    incidentStaffNote: {
      create: noteCreate,
      findFirst: noteFindFirst,
      updateMany: noteUpdateMany,
    },
    incidentStaffNoteRevision: { create: revisionCreate },
  };
  const transaction = jest.fn(async (callback: (client: typeof transactionClient) => unknown) =>
    callback(transactionClient),
  );
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  const service = new IncidentStaffNotesService(prisma, () => now.getTime());

  beforeEach(() => {
    jest.clearAllMocks();
    incidentFindUnique.mockResolvedValue({ id: incidentId });
    noteCreate.mockResolvedValue({
      id: noteId,
      body: 'Internal note',
      version: 1,
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      author: { id: authorId, displayName: 'Moderator' },
    });
    revisionCreate.mockResolvedValue({ id: 'revision-id' });
    noteFindFirst.mockResolvedValue({
      id: noteId,
      body: 'Internal note',
      version: 1,
      authorUserId: authorId,
      createdAt,
      deletedAt: null,
    });
    noteUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('creates the note and immutable revision 1 atomically without touching incident state', async () => {
    await expect(
      service.create(incidentId, { body: 'Internal note' }, moderator),
    ).resolves.toHaveProperty('note.version', 1);
    expect(revisionCreate).toHaveBeenCalledWith({
      data: {
        noteId,
        revisionNumber: 1,
        body: 'Internal note',
        changedByUserId: authorId,
        createdAt: now,
      },
      select: { id: true },
    });
    expect(JSON.stringify(incidentFindUnique.mock.calls[0]![0])).not.toMatch(
      /contact|updatedAt|description/i,
    );
  });

  it('allows the author at the 15-minute boundary and increments exactly once', async () => {
    const boundaryService = new IncidentStaffNotesService(
      prisma,
      () => createdAt.getTime() + 15 * 60 * 1000,
    );
    await boundaryService.edit(
      incidentId,
      noteId,
      { body: 'Corrected note', expectedVersion: 1 },
      moderator,
    );
    expect(noteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: noteId, incidentId, version: 1, deletedAt: null },
        data: expect.objectContaining({ version: 2, body: 'Corrected note' }),
      }),
    );
    expect(revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revisionNumber: 2, body: 'Corrected note' }),
      }),
    );
  });

  it('blocks late author edits and other-moderator edits', async () => {
    const lateService = new IncidentStaffNotesService(
      prisma,
      () => createdAt.getTime() + 15 * 60 * 1000 + 1,
    );
    await expect(
      lateService.edit(
        incidentId,
        noteId,
        { body: 'Late correction', expectedVersion: 1 },
        moderator,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.edit(
        incidentId,
        noteId,
        { body: 'Other correction', expectedVersion: 1 },
        { ...moderator, id: admin.id },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an administrative reason after the author window', async () => {
    await expect(
      service.edit(
        incidentId,
        noteId,
        { body: 'Administrative correction', expectedVersion: 1 },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.edit(
        incidentId,
        noteId,
        {
          body: 'Administrative correction',
          reason: 'Documented administrative correction.',
          expectedVersion: 1,
        },
        admin,
      ),
    ).resolves.toHaveProperty('note.version', 2);
  });

  it('rejects unchanged, stale, deleted, and conditional-race edits', async () => {
    await expect(
      service.edit(incidentId, noteId, { body: 'Internal note', expectedVersion: 1 }, moderator),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.edit(incidentId, noteId, { body: 'Changed', expectedVersion: 2 }, moderator),
    ).rejects.toBeInstanceOf(ConflictException);
    noteFindFirst.mockResolvedValueOnce({
      id: noteId,
      body: 'Internal note',
      version: 1,
      authorUserId: authorId,
      createdAt,
      deletedAt: now,
    });
    await expect(
      service.edit(incidentId, noteId, { body: 'Changed', expectedVersion: 1 }, moderator),
    ).rejects.toBeInstanceOf(BadRequestException);
    noteUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.edit(incidentId, noteId, { body: 'Changed', expectedVersion: 1 }, moderator),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft-redacts without erasing the body and records an immutable revision', async () => {
    await service.redact(
      incidentId,
      noteId,
      { reason: 'Administrative privacy redaction.', expectedVersion: 1 },
      admin,
    );
    expect(noteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deletedAt: now,
          deletedByUserId: admin.id,
          deletionReason: 'Administrative privacy redaction.',
          version: 2,
        }),
      }),
    );
    expect(JSON.stringify(noteUpdateMany.mock.calls[0]![0])).not.toContain('"body"');
    expect(revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: 'Internal note',
          revisionNumber: 2,
        }),
      }),
    );
  });

  it('propagates revision failures so transactions roll back', async () => {
    revisionCreate.mockRejectedValueOnce(new Error('revision failure'));
    await expect(service.create(incidentId, { body: 'Internal note' }, moderator)).rejects.toThrow(
      'revision failure',
    );
  });

  it('returns a body-free tombstone in ordinary lists and never selects contact data', async () => {
    const findUnique = jest.fn(async () => ({ id: incidentId }));
    const findMany = jest.fn<(input: unknown) => Promise<unknown[]>>(async () => [
      {
        id: noteId,
        body: 'Retained database body',
        version: 2,
        createdAt,
        updatedAt: now,
        editedAt: null,
        deletedAt: now,
        author: { id: authorId, displayName: 'Moderator' },
      },
    ]);
    const count = jest.fn(async () => 1);
    const listService = new IncidentStaffNotesService(
      {
        incident: { findUnique },
        incidentStaffNote: { findMany, count },
      } as unknown as PrismaService,
      () => now.getTime(),
    );
    const result = await listService.list(incidentId, { page: 1, pageSize: 20 });
    expect(result.items[0]).toEqual({
      id: noteId,
      isDeleted: true,
      createdAt: createdAt.toISOString(),
      deletedAt: now.toISOString(),
      author: { id: authorId, displayName: 'Moderator' },
    });
    expect(JSON.stringify(findMany.mock.calls[0]![0])).not.toMatch(/contact|deletionReason/i);
  });

  it('returns deterministic immutable revisions with minimal actor fields', async () => {
    const revisionFind = jest.fn<(input: unknown) => Promise<unknown>>(async () => ({
      id: noteId,
      revisions: [
        {
          revisionNumber: 1,
          body: 'Original note',
          changeReason: null,
          createdAt,
          changedBy: { id: authorId, displayName: 'Moderator' },
        },
      ],
    }));
    const revisionService = new IncidentStaffNotesService(
      {
        incidentStaffNote: { findFirst: revisionFind },
      } as unknown as PrismaService,
      () => now.getTime(),
    );
    await expect(revisionService.revisions(incidentId, noteId)).resolves.toEqual({
      items: [
        {
          revisionNumber: 1,
          body: 'Original note',
          changeReason: null,
          changedAt: createdAt.toISOString(),
          changedBy: { id: authorId, displayName: 'Moderator' },
        },
      ],
    });
    expect(revisionFind).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          revisions: expect.objectContaining({
            orderBy: [{ revisionNumber: 'asc' }, { id: 'asc' }],
          }),
        }),
      }),
    );
    expect(JSON.stringify(revisionFind.mock.calls[0]![0])).not.toMatch(
      /password|session|contact|email/i,
    );
  });
});
