import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminOperationsDashboardController } from './admin-operations-dashboard.controller.js';
import {
  AdminOperationsDashboardService,
  OPERATIONS_DASHBOARD_CLOCK,
} from './admin-operations-dashboard.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminOperationsDashboardController],
  providers: [
    AdminOperationsDashboardService,
    { provide: OPERATIONS_DASHBOARD_CLOCK, useValue: Date.now },
  ],
})
export class DashboardModule {}
