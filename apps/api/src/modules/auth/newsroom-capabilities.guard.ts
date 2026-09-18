import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { NewsroomCapability } from '@garkuwa/contracts';
import { Reflector } from '@nestjs/core';

import type { StaffAuthRequest } from './auth.types.js';
import { hasNewsroomCapability } from './newsroom-capabilities.js';
import { NEWSROOM_CAPABILITIES_METADATA } from './newsroom-capabilities.decorator.js';

@Injectable()
export class NewsroomCapabilitiesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly NewsroomCapability[]>(
      NEWSROOM_CAPABILITIES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const principal = context.switchToHttp().getRequest<StaffAuthRequest>().staffPrincipal;
    if (
      !principal ||
      !required.every((capability) => hasNewsroomCapability(principal.role, capability))
    ) {
      throw new ForbiddenException('This staff account cannot perform this newsroom action.');
    }
    return true;
  }
}
