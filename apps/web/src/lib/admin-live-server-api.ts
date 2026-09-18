import 'server-only';

import { cookies } from 'next/headers';

import { staffSessionCookieName } from './admin-auth';
import { adminLiveEventDetailSchema, adminLiveEventListSchema } from './admin-live-api';
import { webEnvironment } from './env';

async function authenticatedGet(path: string) {
  const token = (await cookies()).get(staffSessionCookieName)?.value;
  if (!token) return { kind: 'unauthenticated' as const };
  try {
    const response = await fetch(`${webEnvironment.NEXT_PUBLIC_API_BASE_URL}${path}`, {
      headers: { Cookie: `${staffSessionCookieName}=${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.status === 401) return { kind: 'unauthenticated' as const };
    if (response.status === 403) return { kind: 'forbidden' as const };
    if (response.status === 404) return { kind: 'not-found' as const };
    if (!response.ok) return { kind: 'error' as const };
    return { kind: 'success' as const, data: (await response.json()) as unknown };
  } catch {
    return { kind: 'error' as const };
  }
}

export async function loadAdminLiveEvents(parameters: { page?: string; status?: string }) {
  const query = new URLSearchParams();
  if (parameters.page) query.set('page', parameters.page);
  if (parameters.status) query.set('status', parameters.status);
  const result = await authenticatedGet(`/admin/live?${query}`);
  if (result.kind !== 'success') return result;
  const parsed = adminLiveEventListSchema.safeParse(result.data);
  return parsed.success
    ? { kind: 'success' as const, data: parsed.data }
    : { kind: 'error' as const };
}

export async function loadAdminLiveEvent(eventId: string) {
  const result = await authenticatedGet(`/admin/live/${eventId}`);
  if (result.kind !== 'success') return result;
  const parsed = adminLiveEventDetailSchema.safeParse(result.data);
  return parsed.success
    ? { kind: 'success' as const, data: parsed.data }
    : { kind: 'error' as const };
}
