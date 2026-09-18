import { z } from 'zod';
import {
  publicNewsDetailSchema,
  publicNewsListSchema,
  type PublicNewsDetail,
  type PublicNewsItem,
  type PublicNewsList,
} from '@garkuwa/contracts/media';

import type { Locale } from '@/i18n';

import { webEnvironment } from './env';

export type { PublicNewsItem, PublicNewsList, PublicNewsDetail };
export type PublicNewsResult<T> =
  { kind: 'success'; data: T } | { kind: 'not-found' | 'invalid' | 'unavailable' };

const pageSchema = z.coerce.number().int().positive();
export const publicSecurityAdvisorySeverities = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFORMATIONAL',
] as const;
const severitySchema = z.enum(publicSecurityAdvisorySeverities);

export function parsePublicNewsPage(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (Array.isArray(value)) return null;
  const result = pageSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parsePublicAdvisorySeverity(
  value: string | string[] | undefined,
): (typeof publicSecurityAdvisorySeverities)[number] | undefined | null {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return null;
  const result = severitySchema.safeParse(value);
  return result.success ? result.data : null;
}

function apiUrl(path: string): string {
  return `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/${path}`;
}

export function publicNewsMediaUrl(path: string): string {
  return path.startsWith('http') ? path : apiUrl(path.replace(/^\/+api\//, ''));
}

async function publicNewsFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  fetcher: typeof fetch = fetch,
): Promise<PublicNewsResult<T>> {
  try {
    const response = await fetcher(apiUrl(path), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (response.status === 404) return { kind: 'not-found' };
    if (response.status === 400) return { kind: 'invalid' };
    if (!response.ok) return { kind: 'unavailable' };
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? { kind: 'success', data: parsed.data } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

export function loadPublicNews(
  locale: Locale,
  options: {
    page?: number;
    pageSize?: number;
    category?: string;
    severity?: string;
    fetcher?: typeof fetch;
  } = {},
): Promise<PublicNewsResult<PublicNewsList>> {
  const query = new URLSearchParams({
    lang: locale,
    page: String(options.page ?? 1),
    pageSize: String(options.pageSize ?? 10),
  });
  if (options.category) {
    query.set('category', options.category);
  }
  if (options.severity) query.set('severity', options.severity);
  return publicNewsFetch(`public/news?${query}`, publicNewsListSchema, options.fetcher);
}

export function loadPublicNewsArticle(
  slug: string,
  locale: Locale,
  fetcher?: typeof fetch,
): Promise<PublicNewsResult<PublicNewsDetail>> {
  return publicNewsFetch(
    `public/news/${encodeURIComponent(slug)}?lang=${locale}`,
    publicNewsDetailSchema,
    fetcher,
  );
}
