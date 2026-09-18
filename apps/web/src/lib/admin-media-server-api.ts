import 'server-only';

import { cookies } from 'next/headers';

import { staffSessionCookieName } from './admin-auth';
import { adminMediaListSchema } from './admin-media-api';
import { webEnvironment } from './env';

export async function loadAdminMedia(parameters: {
  page?: string;
  search?: string;
  status?: string;
}) {
  const token = (await cookies()).get(staffSessionCookieName)?.value;
  if (!token) return { kind: 'unauthenticated' as const };
  const query = new URLSearchParams();
  if (parameters.page) query.set('page', parameters.page);
  if (parameters.search) query.set('search', parameters.search);
  if (parameters.status) query.set('status', parameters.status);

  try {
    const response = await fetch(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL}/admin/media?${query}`,
      {
        headers: { Cookie: `${staffSessionCookieName}=${token}`, Accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (response.status === 401) return { kind: 'unauthenticated' as const };
    if (response.status === 403) return { kind: 'forbidden' as const };
    if (!response.ok) return { kind: 'error' as const };
    const parsed = adminMediaListSchema.safeParse(await response.json());
    return parsed.success
      ? { kind: 'success' as const, data: parsed.data }
      : { kind: 'error' as const };
  } catch {
    return { kind: 'error' as const };
  }
}
