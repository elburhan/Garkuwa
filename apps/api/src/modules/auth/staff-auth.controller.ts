import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { getApiEnvironment } from '../../config/environment.js';
import { STAFF_SESSION_COOKIE_NAME, STAFF_SESSION_DURATION_MS } from './auth.constants.js';
import { StaffAuthenticationService } from './staff-authentication.service.js';
import { staffLoginSchema, StaffAuthZodPipe, type StaffLoginDto } from './staff-auth.dto.js';
import { StaffAuthOriginGuard } from './staff-auth-origin.guard.js';
import type { StaffAuthCookieResponse, StaffAuthRequest, StaffPrincipal } from './auth.types.js';
import { JsonContentTypeGuard } from './json-content-type.guard.js';
import { StaffLoginRateLimitGuard } from './staff-login-rate-limit.guard.js';
import { readCookie, StaffSessionGuard } from './staff-session.guard.js';
import { StaffSessionService } from './staff-session.service.js';

function cookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: getApiEnvironment().STAFF_SESSION_COOKIE_SECURE,
    path: '/',
    maxAge: STAFF_SESSION_DURATION_MS,
  };
}

function clearCookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: getApiEnvironment().STAFF_SESSION_COOKIE_SECURE,
    path: '/',
  };
}

@Controller('auth/staff')
export class StaffAuthController {
  constructor(
    @Inject(StaffAuthenticationService)
    private readonly authentication: StaffAuthenticationService,
    @Inject(StaffSessionService) private readonly sessions: StaffSessionService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, StaffLoginRateLimitGuard)
  async login(
    @Body(new StaffAuthZodPipe(staffLoginSchema)) input: StaffLoginDto,
    @Res({ passthrough: true }) response: StaffAuthCookieResponse,
  ): Promise<{ authenticated: true; user: StaffPrincipal }> {
    const result = await this.authentication.login(input);
    response.cookie(STAFF_SESSION_COOKIE_NAME, result.token, cookieOptions());
    return { authenticated: true, user: result.user };
  }

  @Get('me')
  @UseGuards(StaffSessionGuard)
  me(@Req() request: StaffAuthRequest): { authenticated: true; user: StaffPrincipal } {
    return { authenticated: true, user: request.staffPrincipal! };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffAuthOriginGuard)
  async logout(
    @Req() request: StaffAuthRequest,
    @Res({ passthrough: true }) response: StaffAuthCookieResponse,
  ): Promise<{ authenticated: false }> {
    const token = readCookie(request.headers.cookie, STAFF_SESSION_COOKIE_NAME);
    if (token) await this.sessions.revoke(token);
    response.clearCookie(STAFF_SESSION_COOKIE_NAME, clearCookieOptions());
    return { authenticated: false };
  }
}
