import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { IncidentsModule } from './modules/incidents/incidents.module.js';

@Module({
  imports: [DatabaseModule, HealthModule, AuthModule, IncidentsModule],
})
export class AppModule {}
