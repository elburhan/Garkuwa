import { cookies } from 'next/headers';

import { webEnvironment } from './env';

export const staffSessionCookieName = 'garkuwa_staff_session';

export interface AdminPrincipal {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'EDITOR' | 'ANALYST';
}

function authApiUrl(path: string): string {
  return `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/${path}`;
}

function isAdminPrincipal(value: unknown): value is AdminPrincipal {
  if (!value || typeof value !== 'object') return false;
  const principal = value as Record<string, unknown>;
  return (
    typeof principal.id === 'string' &&
    typeof principal.email === 'string' &&
    typeof principal.name === 'string' &&
    typeof principal.role === 'string'
  );
}

export async function getAdminPrincipal(
  fetcher: typeof fetch = fetch,
): Promise<AdminPrincipal | null> {
  const token = (await cookies()).get(staffSessionCookieName)?.value;
  if (!token) return null;

  try {
    const response = await fetcher(authApiUrl('auth/staff/me'), {
      method: 'GET',
      headers: { Cookie: `${staffSessionCookieName}=${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { user?: unknown };
    return isAdminPrincipal(body.user) ? body.user : null;
  } catch {
    return null;
  }
}
