import { SetMetadata } from '@nestjs/common';

import type { StaffRole } from '../../generated/prisma/enums.js';

export const STAFF_ROLES_METADATA = 'staff-roles';

export const StaffRoles = (...roles: readonly StaffRole[]) =>
  SetMetadata(STAFF_ROLES_METADATA, roles);
