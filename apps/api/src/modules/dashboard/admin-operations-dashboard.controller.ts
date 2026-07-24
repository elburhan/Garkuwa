import { Controller, Get, Header, Inject, Query, UseGuards } from '@nestjs/common';

import { StaffRole } from '../../generated/prisma/enums.js';
import { StaffRoles } from '../auth/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/staff-roles.guard.js';
import { StaffSessionGuard } from '../auth/staff-session.guard.js';
import { AdminOperationsDashboardService } from './admin-operations-dashboard.service.js';
import {
  OperationsDashboardQueryPipe,
  type OperationsDashboardQuery,
} from './dto/operations-dashboard-query.dto.js';

@Controller('admin/dashboard')
@UseGuards(StaffSessionGuard, StaffRolesGuard)
@StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR, StaffRole.ANALYST)
export class AdminOperationsDashboardController {
  constructor(
    @Inject(AdminOperationsDashboardService)
    private readonly dashboard: AdminOperationsDashboardService,
  ) {}

  @Get('operations')
  @Header('Cache-Control', 'private, no-store')
  operations(
    @Query(new OperationsDashboardQueryPipe())
    query: OperationsDashboardQuery,
  ) {
    return this.dashboard.operations(query);
  }
}
