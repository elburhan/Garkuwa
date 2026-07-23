import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { STAFF_SESSION_COOKIE_NAME } from './auth.constants.js';
import type { StaffAuthRequest } from './auth.types.js';
import { StaffSessionService } from './staff-session.service.js';

export function readCookie(
  cookieHeader: string | string[] | undefined,
  name: string,
): string | undefined {
  if (typeof cookieHeader !== 'string') return undefined;
  for (const part of cookieHeader.split(';')) {
    const [cookieName, ...valueParts] = part.trim().split('=');
    if (cookieName === name) return valueParts.join('=') || undefined;
  }
  return undefined;
}

@Injectable()
export class StaffSessionGuard implements CanActivate {
  constructor(@Inject(StaffSessionService) private readonly sessions: StaffSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();
    const token = readCookie(request.headers.cookie, STAFF_SESSION_COOKIE_NAME);
    const principal = token ? await this.sessions.authenticate(token) : null;
    if (!principal) throw new UnauthorizedException('A valid staff session is required.');
    request.staffPrincipal = principal;
    return true;
  }
}
