import { Module } from '@nestjs/common';

import { STAFF_AUTH_CLOCK } from './auth.constants.js';
import { StaffAuthenticationService } from './staff-authentication.service.js';
import { StaffAuthController } from './staff-auth.controller.js';
import { StaffAuthOriginGuard } from './staff-auth-origin.guard.js';
import { JsonContentTypeGuard } from './json-content-type.guard.js';
import { PasswordHasherService } from './password-hasher.service.js';
import { StaffLoginRateLimitGuard } from './staff-login-rate-limit.guard.js';
import { StaffSessionGuard } from './staff-session.guard.js';
import { StaffSessionService } from './staff-session.service.js';
import { StaffRolesGuard } from './staff-roles.guard.js';

@Module({
  controllers: [StaffAuthController],
  providers: [
    PasswordHasherService,
    StaffAuthenticationService,
    StaffSessionService,
    StaffSessionGuard,
    StaffRolesGuard,
    StaffAuthOriginGuard,
    JsonContentTypeGuard,
    StaffLoginRateLimitGuard,
    { provide: STAFF_AUTH_CLOCK, useValue: Date.now },
  ],
  exports: [
    StaffSessionGuard,
    StaffSessionService,
    StaffRolesGuard,
    StaffAuthOriginGuard,
    JsonContentTypeGuard,
  ],
})
export class AuthModule {}
