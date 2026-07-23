import type { StaffRole } from '../../generated/prisma/enums.js';

export interface StaffPrincipal {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
}

export interface StaffAuthRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  staffPrincipal?: StaffPrincipal;
}

export interface StaffAuthCookieResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
}
