import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminLiveController } from './admin-live.controller.js';
import { LIVE_CLOCK, LiveService } from './live.service.js';
import { PublicLiveController } from './public-live.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminLiveController, PublicLiveController],
  providers: [LiveService, { provide: LIVE_CLOCK, useValue: Date.now }],
})
export class LiveModule {}
