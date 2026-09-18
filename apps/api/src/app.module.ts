import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { IncidentsModule } from './modules/incidents/incidents.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { NewsModule } from './modules/news/news.module.js';
import { InstitutionalContentModule } from './modules/institutional-content/institutional-content.module.js';
import { NewsroomMediaModule } from './modules/media/newsroom-media.module.js';
import { LiveModule } from './modules/live/live.module.js';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    AuthModule,
    IncidentsModule,
    DashboardModule,
    NewsModule,
    InstitutionalContentModule,
    NewsroomMediaModule,
    LiveModule,
  ],
})
export class AppModule {}
