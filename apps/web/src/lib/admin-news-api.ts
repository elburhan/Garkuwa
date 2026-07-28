import { cookies } from 'next/headers';
import { z } from 'zod';

import { staffSessionCookieName } from './admin-auth';
import { webEnvironment } from './env';

export const newsStatuses = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
export type NewsStatus = (typeof newsStatuses)[number];

const authorSchema = z.object({ id: z.string(), displayName: z.string() });
const listItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  status: z.enum(newsStatuses),
  titleHa: z.string(),
  titleEn: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: authorSchema,
});
const articleSchema = listItemSchema.extend({
  summaryHa: z.string(),
  bodyHa: z.string(),
  summaryEn: z.string().nullable(),
  bodyEn: z.string().nullable(),
  submittedForReviewAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
});
const listSchema = z.object({
  items: z.array(listItemSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
const detailSchema = z.object({ article: articleSchema });
const historySchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      fromStatus: z.enum(newsStatuses).nullable(),
      toStatus: z.enum(newsStatuses),
      reason: z.string().nullable(),
      createdAt: z.string(),
      actor: authorSchema,
    }),
  ),
});

export type NewsArticleList = z.infer<typeof listSchema>;
export type NewsArticle = z.infer<typeof articleSchema>;
export type NewsHistory = z.infer<typeof historySchema>;
export type AdminNewsSearchParams = Record<string, string | string[] | undefined>;
export type NewsApiResult<T> =
  | { kind: 'success'; data: T }
  | {
      kind:
        | 'unauthenticated'
        | 'forbidden'
        | 'not-found'
        | 'validation'
        | 'conflict'
        | 'rate-limit'
        | 'error';
    };

function apiUrl(path: string): string {
  return `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/${path}`;
}

async function serverGet<T>(path: string, schema: z.ZodType<T>): Promise<NewsApiResult<T>> {
  const token = (await cookies()).get(staffSessionCookieName)?.value;
  if (!token) return { kind: 'unauthenticated' };
  try {
    const response = await fetch(apiUrl(path), {
      headers: { Cookie: `${staffSessionCookieName}=${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 404) return { kind: 'not-found' };
    if (!response.ok) return { kind: 'error' };
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? { kind: 'success', data: parsed.data } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function buildNewsPath(
  parameters: AdminNewsSearchParams,
  changes: Record<string, string | number | undefined> = {},
): string {
  const values: Record<string, string | undefined> = {
    page: first(parameters.page),
    status: first(parameters.status),
    lang: first(parameters.lang),
  };
  for (const [key, value] of Object.entries(changes)) values[key] = value?.toString();
  const query = new URLSearchParams();
  for (const key of ['page', 'status', 'lang']) {
    if (values[key]) query.set(key, values[key]!);
  }
  const suffix = query.toString();
  return `/admin/news${suffix ? `?${suffix}` : ''}`;
}

export async function loadNewsArticles(parameters: AdminNewsSearchParams) {
  const query = new URLSearchParams();
  const page = first(parameters.page);
  const status = first(parameters.status);
  if (page) query.set('page', page);
  if (status) query.set('status', status);
  return serverGet(`admin/news?${query}`, listSchema);
}

export async function loadNewsArticle(articleId: string) {
  return serverGet(`admin/news/${articleId}`, detailSchema);
}

export async function loadNewsHistory(articleId: string) {
  return serverGet(`admin/news/${articleId}/history`, historySchema);
}
