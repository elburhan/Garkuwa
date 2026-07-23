import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { getApiEnvironment } from '../../config/environment.js';
import type { StaffAuthRequest } from './auth.types.js';

@Injectable()
export class StaffAuthOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();
    const origin = request.headers.origin;
    if (typeof origin !== 'string' || origin !== getApiEnvironment().WEB_ORIGIN) {
      throw new ForbiddenException('The request origin is not allowed.');
    }
    return true;
  }
}
