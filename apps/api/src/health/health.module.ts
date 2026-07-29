import { Module } from '@nestjs/common';

import { IncidentsModule } from '../modules/incidents/incidents.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [IncidentsModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
