import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import {
  AdminInstitutionalContentController,
  PublicInstitutionalContentController,
} from './institutional-content.controller.js';
import {
  INSTITUTIONAL_CONTENT_MUTATION_CLOCK,
  InstitutionalContentRateLimitGuard,
} from './institutional-content-rate-limit.guard.js';
import {
  INSTITUTIONAL_CONTENT_CLOCK,
  InstitutionalContentService,
} from './institutional-content.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminInstitutionalContentController, PublicInstitutionalContentController],
  providers: [
    InstitutionalContentService,
    InstitutionalContentRateLimitGuard,
    { provide: INSTITUTIONAL_CONTENT_CLOCK, useValue: Date.now },
    { provide: INSTITUTIONAL_CONTENT_MUTATION_CLOCK, useValue: Date.now },
  ],
})
export class InstitutionalContentModule {}
