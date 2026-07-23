import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import { StaffRole, UserStatus } from '../../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../../auth/auth.types.js';
import type {
  UpdateIncidentAssignmentDto,
  UpdateIncidentStatusDto,
} from './dto/incident-workflow.dto.js';
import {
  incidentStatusTransitionRequiresReason,
  isAllowedIncidentStatusTransition,
} from './incident-status-transitions.js';

export const INCIDENT_WORKFLOW_CLOCK = Symbol('INCIDENT_WORKFLOW_CLOCK');
export type IncidentWorkflowClock = () => number;

const eligibleAssigneeRoles = [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR];
const minimalStaffSelect = { id: true, displayName: true } as const;

function conflict(): ConflictException {
  return new ConflictException('The incident changed and must be refreshed.');
}

function nextWorkflowTimestamp(current: Date, clock: IncidentWorkflowClock): Date {
  return new Date(Math.max(clock(), current.getTime() + 1));
}

@Injectable()
export class IncidentWorkflowService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(INCIDENT_WORKFLOW_CLOCK) private readonly clock: IncidentWorkflowClock,
  ) {}

  async updateStatus(incidentId: string, input: UpdateIncidentStatusDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const incident = await transaction.incident.findUnique({
        where: { id: incidentId },
        select: { id: true, internalCaseId: true, status: true, updatedAt: true },
      });
      if (!incident) throw new NotFoundException('Incident not found.');

      const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
      if (incident.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
      if (!isAllowedIncidentStatusTransition(incident.status, input.toStatus)) {
        throw new BadRequestException('The requested status transition is not allowed.');
      }
      if (
        incidentStatusTransitionRequiresReason(incident.status, input.toStatus) &&
        !input.reason
      ) {
        throw new BadRequestException('A reason is required for this status transition.');
      }

      const changedAt = nextWorkflowTimestamp(incident.updatedAt, this.clock);
      const updated = await transaction.incident.updateMany({
        where: { id: incidentId, updatedAt: expectedUpdatedAt },
        data: {
          status: input.toStatus,
          updatedAt: changedAt,
          ...(input.toStatus === 'CLOSED'
            ? { closedAt: changedAt }
            : incident.status === 'CLOSED'
              ? { closedAt: null }
              : {}),
        },
      });
      if (updated.count !== 1) throw conflict();

      const history = await transaction.incidentStatusHistory.create({
        data: {
          incidentId,
          fromStatus: incident.status,
          toStatus: input.toStatus,
          changedByUserId: actor.id,
          comment: input.reason ?? null,
          createdAt: changedAt,
        },
        select: {
          fromStatus: true,
          toStatus: true,
          comment: true,
          createdAt: true,
          changedByUser: { select: minimalStaffSelect },
        },
      });

      return {
        incident: {
          id: incident.id,
          internalCaseId: incident.internalCaseId,
          status: input.toStatus,
          updatedAt: changedAt.toISOString(),
        },
        historyEntry: {
          fromStatus: history.fromStatus,
          toStatus: history.toStatus,
          comment: history.comment,
          changedAt: history.createdAt.toISOString(),
          changedBy: history.changedByUser,
        },
      };
    });
  }

  async updateAssignment(
    incidentId: string,
    input: UpdateIncidentAssignmentDto,
    actor: StaffPrincipal,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const incident = await transaction.incident.findUnique({
        where: { id: incidentId },
        select: {
          id: true,
          internalCaseId: true,
          assignedToUserId: true,
          updatedAt: true,
        },
      });
      if (!incident) throw new NotFoundException('Incident not found.');

      const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
      if (incident.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict();
      if (incident.assignedToUserId === input.assignedToUserId) {
        throw new BadRequestException('The incident assignment is unchanged.');
      }

      let assignee: { id: string; displayName: string; role: StaffRole } | null = null;
      if (input.assignedToUserId) {
        const candidate = await transaction.user.findFirst({
          where: {
            id: input.assignedToUserId,
            status: UserStatus.ACTIVE,
            role: { in: eligibleAssigneeRoles },
          },
          select: { id: true, displayName: true, role: true },
        });
        if (!candidate) throw new NotFoundException('Eligible assignee not found.');
        assignee = candidate;
      }

      const changedAt = nextWorkflowTimestamp(incident.updatedAt, this.clock);
      const updated = await transaction.incident.updateMany({
        where: { id: incidentId, updatedAt: expectedUpdatedAt },
        data: { assignedToUserId: input.assignedToUserId, updatedAt: changedAt },
      });
      if (updated.count !== 1) throw conflict();

      await transaction.incidentAssignmentHistory.create({
        data: {
          incidentId,
          fromUserId: incident.assignedToUserId,
          toUserId: input.assignedToUserId,
          changedByUserId: actor.id,
          comment: input.reason ?? null,
          createdAt: changedAt,
        },
        select: { id: true },
      });

      return {
        incident: {
          id: incident.id,
          internalCaseId: incident.internalCaseId,
          assignedTo: assignee,
          updatedAt: changedAt.toISOString(),
        },
      };
    });
  }

  async eligibleAssignees() {
    const users = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVE, role: { in: eligibleAssigneeRoles } },
      select: { id: true, displayName: true, email: true, role: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: 500,
    });
    return { users };
  }
}
