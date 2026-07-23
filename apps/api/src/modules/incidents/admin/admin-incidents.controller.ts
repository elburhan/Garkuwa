import { Body, Controller, Get, Inject, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';

import { StaffRole } from '../../../generated/prisma/enums.js';
import { StaffRoles } from '../../auth/staff-roles.decorator.js';
import { StaffRolesGuard } from '../../auth/staff-roles.guard.js';
import { StaffSessionGuard } from '../../auth/staff-session.guard.js';
import { StaffAuthOriginGuard } from '../../auth/staff-auth-origin.guard.js';
import { JsonContentTypeGuard } from '../../auth/json-content-type.guard.js';
import type { StaffAuthRequest } from '../../auth/auth.types.js';
import { AdminIncidentsService } from './admin-incidents.service.js';
import {
  AdminIncidentsZodPipe,
  incidentIdParamSchema,
  listAdminIncidentsQuerySchema,
} from './dto/admin-incidents.dto.js';
import type { IncidentIdParam, ListAdminIncidentsQuery } from './dto/admin-incidents.dto.js';
import {
  updateIncidentAssignmentSchema,
  updateIncidentStatusSchema,
} from '../workflow/dto/incident-workflow.dto.js';
import type {
  UpdateIncidentAssignmentDto,
  UpdateIncidentStatusDto,
} from '../workflow/dto/incident-workflow.dto.js';
import { IncidentWorkflowService } from '../workflow/incident-workflow.service.js';

const incidentViewerRoles = [
  StaffRole.SUPER_ADMIN,
  StaffRole.ADMIN,
  StaffRole.MODERATOR,
  StaffRole.ANALYST,
] as const;

@Controller('admin/incidents')
@UseGuards(StaffSessionGuard, StaffRolesGuard)
@StaffRoles(...incidentViewerRoles)
export class AdminIncidentsController {
  constructor(
    @Inject(AdminIncidentsService) private readonly incidents: AdminIncidentsService,
    @Inject(IncidentWorkflowService) private readonly workflow: IncidentWorkflowService,
  ) {}

  @Get()
  list(
    @Query(new AdminIncidentsZodPipe(listAdminIncidentsQuerySchema))
    query: ListAdminIncidentsQuery,
  ) {
    return this.incidents.list(query);
  }

  @Get('eligible-assignees')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN)
  eligibleAssignees() {
    return this.workflow.eligibleAssignees();
  }

  @Get(':incidentId')
  detail(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema))
    parameters: IncidentIdParam,
  ) {
    return this.incidents.detail(parameters.incidentId);
  }

  @Patch(':incidentId/status')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard)
  updateStatus(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema)) parameters: IncidentIdParam,
    @Body(new AdminIncidentsZodPipe(updateIncidentStatusSchema)) input: UpdateIncidentStatusDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.workflow.updateStatus(parameters.incidentId, input, request.staffPrincipal!);
  }

  @Patch(':incidentId/assignment')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard)
  updateAssignment(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema)) parameters: IncidentIdParam,
    @Body(new AdminIncidentsZodPipe(updateIncidentAssignmentSchema))
    input: UpdateIncidentAssignmentDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.workflow.updateAssignment(parameters.incidentId, input, request.staffPrincipal!);
  }
}
