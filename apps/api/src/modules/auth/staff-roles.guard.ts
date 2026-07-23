import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { StaffRole } from '../../generated/prisma/enums.js';
import { STAFF_ROLES_METADATA } from './staff-roles.decorator.js';
import type { StaffAuthRequest } from './auth.types.js';

@Injectable()
export class StaffRolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<readonly StaffRole[]>(
      STAFF_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!allowedRoles?.length) return true;

    const principal = context.switchToHttp().getRequest<StaffAuthRequest>().staffPrincipal;
    if (!principal || !allowedRoles.includes(principal.role)) {
      throw new ForbiddenException('This staff account cannot access this resource.');
    }
    return true;
  }
}
