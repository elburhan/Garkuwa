import { z } from 'zod';

import type { Locale } from '@/i18n';

import { webEnvironment } from './env';

const httpsUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
});

const publicNewsItemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  publishedAt: z.iso.datetime({ offset: true }),
  hasEnglishTranslation: z.boolean(),
  category: z.object({ slug: z.string(), name: z.string() }),
  securityAdvisory: z
    .object({
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']),
    })
    .nullable(),
});
const publicNewsListSchema = z.object({
  generatedAt: z.iso.datetime({ offset: true }),
  items: z.array(publicNewsItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
const publicNewsDetailSchema = publicNewsItemSchema.extend({
  body: z.string(),
  securityAdvisory: z
    .object({
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']),
      affectedArea: z.string(),
      recommendedActions: z.string(),
      references: z
        .array(
          z.object({
            label: z.string(),
            url: httpsUrlSchema,
          }),
        )
        .max(10),
    })
    .nullable(),
});

export type PublicNewsItem = z.infer<typeof publicNewsItemSchema>;
export type PublicNewsList = z.infer<typeof publicNewsListSchema>;
export type PublicNewsDetail = z.infer<typeof publicNewsDetailSchema>;
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
