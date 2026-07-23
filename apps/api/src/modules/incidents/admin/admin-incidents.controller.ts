import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';

import { StaffRole } from '../../../generated/prisma/enums.js';
import { StaffRoles } from '../../auth/staff-roles.decorator.js';
import { StaffRolesGuard } from '../../auth/staff-roles.guard.js';
import { StaffSessionGuard } from '../../auth/staff-session.guard.js';
import { AdminIncidentsService } from './admin-incidents.service.js';
import {
  AdminIncidentsZodPipe,
  incidentIdParamSchema,
  listAdminIncidentsQuerySchema,
} from './dto/admin-incidents.dto.js';
import type { IncidentIdParam, ListAdminIncidentsQuery } from './dto/admin-incidents.dto.js';

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
  constructor(@Inject(AdminIncidentsService) private readonly incidents: AdminIncidentsService) {}

  @Get()
  list(
    @Query(new AdminIncidentsZodPipe(listAdminIncidentsQuerySchema))
    query: ListAdminIncidentsQuery,
  ) {
    return this.incidents.list(query);
  }

  @Get(':incidentId')
  detail(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema))
    parameters: IncidentIdParam,
  ) {
    return this.incidents.detail(parameters.incidentId);
  }
}
