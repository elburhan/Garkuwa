import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { jest } from '@jest/globals';

import { StaffRole } from '../src/generated/prisma/enums.js';
import { StaffRolesGuard } from '../src/modules/auth/staff-roles.guard.js';

describe('StaffRolesGuard', () => {
  it('allows configured roles and rejects other authenticated roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => [StaffRole.MODERATOR]),
    } as unknown as Reflector;
    const guard = new StaffRolesGuard(reflector);
    const contextFor = (role: StaffRole) =>
      ({
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => ({ staffPrincipal: { role } }) }),
      }) as unknown as ExecutionContext;

    expect(guard.canActivate(contextFor(StaffRole.MODERATOR))).toBe(true);
    expect(() => guard.canActivate(contextFor(StaffRole.EDITOR))).toThrow(ForbiddenException);
  });
});
