import {
  publicLiveEventDetailSchema,
  publicLiveEventListSchema,
  liveIncrementalResponseSchema,
  type LiveIncrementalResponse,
  type PublicLiveEventDetail,
  type PublicLiveEventList,
} from '@garkuwa/contracts/live';

import { webEnvironment } from './env';

export type { PublicLiveEventDetail, PublicLiveEventList };
export type PublicLiveResult<T> =
  { kind: 'success'; data: T } | { kind: 'not-found' | 'unavailable' };

function apiUrl(path: string): string {
  return `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/${path}`;
}

export async function loadPublicLiveEvents(
  page = 1,
  language: 'ha' | 'en' = 'ha',
  fetcher: typeof fetch = fetch,
): Promise<PublicLiveResult<PublicLiveEventList>> {
  try {
    const response = await fetcher(apiUrl(`public/live?page=${page}&lang=${language}`), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 30 },
    });
    if (!response.ok) return { kind: 'unavailable' };
    const parsed = publicLiveEventListSchema.safeParse(await response.json());
    return parsed.success ? { kind: 'success', data: parsed.data } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

export async function loadPublicLiveEvent(
  slug: string,
  language: 'ha' | 'en' = 'ha',
  beforeSequence?: number,
  fetcher: typeof fetch = fetch,
): Promise<PublicLiveResult<PublicLiveEventDetail>> {
  try {
    const query = new URLSearchParams({ lang: language });
    if (beforeSequence) query.set('beforeSequence', String(beforeSequence));
    const response = await fetcher(apiUrl(`public/live/${encodeURIComponent(slug)}?${query}`), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 15 },
    });
    if (response.status === 404) return { kind: 'not-found' };
    if (!response.ok) return { kind: 'unavailable' };
    const parsed = publicLiveEventDetailSchema.safeParse(await response.json());
    return parsed.success ? { kind: 'success', data: parsed.data } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

export async function loadIncrementalLiveUpdates(
  slug: string,
  language: 'ha' | 'en',
  afterSequence: number,
  changedAfter: string,
  fetcher: typeof fetch = fetch,
): Promise<PublicLiveResult<LiveIncrementalResponse>> {
  try {
    const query = new URLSearchParams({
      lang: language,
      afterSequence: String(afterSequence),
      changedAfter,
    });
    const response = await fetcher(
      apiUrl(`public/live/${encodeURIComponent(slug)}/updates?${query}`),
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (response.status === 404) return { kind: 'not-found' };
    if (!response.ok) return { kind: 'unavailable' };
    const parsed = liveIncrementalResponseSchema.safeParse(await response.json());
    return parsed.success ? { kind: 'success', data: parsed.data } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
