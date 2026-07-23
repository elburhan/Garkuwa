import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import { StaffRole } from '../../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../../auth/auth.types.js';
import type {
  CreateStaffNoteDto,
  EditStaffNoteDto,
  ListStaffNotesQuery,
  RedactStaffNoteDto,
} from './dto/staff-note.dto.js';
import { STAFF_NOTE_CLOCK, type StaffNoteClock } from './staff-note-rate-limit.guard.js';

const SELF_EDIT_WINDOW_MS = 15 * 60 * 1000;
const authorSelect = { id: true, displayName: true } as const;

function conflict(): ConflictException {
  return new ConflictException('The note changed and must be refreshed.');
}

function noteResponse(note: {
  id: string;
  body: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  author: { id: string; displayName: string };
}) {
  return {
    id: note.id,
    body: note.body,
    version: note.version,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    editedAt: note.editedAt?.toISOString() ?? null,
    author: note.author,
    isDeleted: false,
  };
}

@Injectable()
export class IncidentStaffNotesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(STAFF_NOTE_CLOCK) private readonly clock: StaffNoteClock,
  ) {}

  async create(incidentId: string, input: CreateStaffNoteDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const incident = await transaction.incident.findUnique({
        where: { id: incidentId },
        select: { id: true },
      });
      if (!incident) throw new NotFoundException('Incident not found.');
      const now = new Date(this.clock());
      const note = await transaction.incidentStaffNote.create({
        data: {
          incidentId,
          authorUserId: actor.id,
          body: input.body,
          createdAt: now,
          updatedAt: now,
        },
        select: {
          id: true,
          body: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          editedAt: true,
          author: { select: authorSelect },
        },
      });
      await transaction.incidentStaffNoteRevision.create({
        data: {
          noteId: note.id,
          revisionNumber: 1,
          body: input.body,
          changedByUserId: actor.id,
          createdAt: now,
        },
        select: { id: true },
      });
      return { note: noteResponse(note) };
    });
  }

  async list(incidentId: string, query: ListStaffNotesQuery) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true },
    });
    if (!incident) throw new NotFoundException('Incident not found.');
    const where = { incidentId };
    const [notes, totalItems] = await Promise.all([
      this.prisma.incidentStaffNote.findMany({
        where,
        select: {
          id: true,
          body: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          editedAt: true,
          deletedAt: true,
          author: { select: authorSelect },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.incidentStaffNote.count({ where }),
    ]);
    return {
      items: notes.map((note) =>
        note.deletedAt
          ? {
              id: note.id,
              isDeleted: true,
              createdAt: note.createdAt.toISOString(),
              deletedAt: note.deletedAt.toISOString(),
              author: note.author,
            }
          : noteResponse(note),
      ),
      pagination: {
        ...query,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async edit(incidentId: string, noteId: string, input: EditStaffNoteDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const note = await transaction.incidentStaffNote.findFirst({
        where: { id: noteId, incidentId },
        select: {
          id: true,
          body: true,
          version: true,
          authorUserId: true,
          createdAt: true,
          deletedAt: true,
        },
      });
      if (!note) throw new NotFoundException('Staff note not found.');
      if (note.deletedAt) throw new BadRequestException('A redacted note cannot be edited.');
      if (note.version !== input.expectedVersion) throw conflict();
      if (note.body === input.body) throw new BadRequestException('The note body is unchanged.');

      const nowMs = this.clock();
      const isAuthorWithinWindow =
        note.authorUserId === actor.id && nowMs - note.createdAt.getTime() <= SELF_EDIT_WINDOW_MS;
      const isAdministrator =
        actor.role === StaffRole.SUPER_ADMIN || actor.role === StaffRole.ADMIN;
      if (!isAuthorWithinWindow && !isAdministrator) {
        throw new ForbiddenException('This note cannot be edited by the current staff member.');
      }
      if (!isAuthorWithinWindow && isAdministrator && !input.reason) {
        throw new BadRequestException('An administrative correction reason is required.');
      }

      const now = new Date(nowMs);
      const nextVersion = note.version + 1;
      const updated = await transaction.incidentStaffNote.updateMany({
        where: { id: noteId, incidentId, version: input.expectedVersion, deletedAt: null },
        data: {
          body: input.body,
          version: nextVersion,
          editedAt: now,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) throw conflict();
      await transaction.incidentStaffNoteRevision.create({
        data: {
          noteId,
          revisionNumber: nextVersion,
          body: input.body,
          changedByUserId: actor.id,
          changeReason: input.reason ?? null,
          createdAt: now,
        },
        select: { id: true },
      });
      return {
        note: {
          id: noteId,
          body: input.body,
          version: nextVersion,
          updatedAt: now.toISOString(),
          editedAt: now.toISOString(),
          isDeleted: false,
        },
      };
    });
  }

  async redact(
    incidentId: string,
    noteId: string,
    input: RedactStaffNoteDto,
    actor: StaffPrincipal,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const note = await transaction.incidentStaffNote.findFirst({
        where: { id: noteId, incidentId },
        select: { id: true, body: true, version: true, deletedAt: true },
      });
      if (!note) throw new NotFoundException('Staff note not found.');
      if (note.deletedAt) throw new BadRequestException('The note is already redacted.');
      if (note.version !== input.expectedVersion) throw conflict();
      const now = new Date(this.clock());
      const nextVersion = note.version + 1;
      const updated = await transaction.incidentStaffNote.updateMany({
        where: { id: noteId, incidentId, version: input.expectedVersion, deletedAt: null },
        data: {
          version: nextVersion,
          deletedAt: now,
          deletedByUserId: actor.id,
          deletionReason: input.reason,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) throw conflict();
      await transaction.incidentStaffNoteRevision.create({
        data: {
          noteId,
          revisionNumber: nextVersion,
          body: note.body,
          changedByUserId: actor.id,
          changeReason: input.reason,
          createdAt: now,
        },
        select: { id: true },
      });
      return { note: { id: noteId, isDeleted: true, deletedAt: now.toISOString() } };
    });
  }

  async revisions(incidentId: string, noteId: string) {
    const note = await this.prisma.incidentStaffNote.findFirst({
      where: { id: noteId, incidentId },
      select: {
        id: true,
        revisions: {
          select: {
            revisionNumber: true,
            body: true,
            changeReason: true,
            createdAt: true,
            changedBy: { select: authorSelect },
          },
          orderBy: [{ revisionNumber: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!note) throw new NotFoundException('Staff note not found.');
    return {
      items: note.revisions.map((revision) => ({
        revisionNumber: revision.revisionNumber,
        body: revision.body,
        changeReason: revision.changeReason,
        changedAt: revision.createdAt.toISOString(),
        changedBy: revision.changedBy,
      })),
    };
  }
}
