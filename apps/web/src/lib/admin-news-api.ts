import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  newsroomArticleListResponseSchema,
  newsroomStatuses,
  type NewsroomArticleListResponse,
} from '@garkuwa/contracts/newsroom';

import { staffSessionCookieName } from './admin-auth';
import { webEnvironment } from './env';

export const newsStatuses = newsroomStatuses;
export type NewsStatus = (typeof newsStatuses)[number];
export const newsCategoryCodes = [
  'ANNOUNCEMENTS',
  'SECURITY_ADVISORIES',
  'COMMUNITY_UPDATES',
  'FOUNDATION_ACTIVITIES',
  'LIVE_UPDATES',
  'NEWS',
] as const;
export type NewsCategoryCode = (typeof newsCategoryCodes)[number];
export const securityAdvisorySeverities = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFORMATIONAL',
] as const;
export type SecurityAdvisorySeverity = (typeof securityAdvisorySeverities)[number];

const authorSchema = z.object({ id: z.string(), displayName: z.string() });
const httpsUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
});
const categorySchema = z.object({
  code: z.enum(newsCategoryCodes),
  slug: z.string(),
  nameHa: z.string(),
  nameEn: z.string(),
});
const securityAdvisorySchema = z.object({
  severity: z.enum(securityAdvisorySeverities),
  affectedAreaHa: z.string(),
  affectedAreaEn: z.string().nullable(),
  recommendedActionsHa: z.string(),
  recommendedActionsEn: z.string().nullable(),
  referencesJson: z.array(
    z.object({
      label: z.string(),
      url: httpsUrlSchema,
    }),
  ),
});
const articleMediaProjectionSchema = z.object({
  id: z.string(),
  mimeType: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  altTextHa: z.string(),
  altTextEn: z.string().nullable(),
  captionHa: z.string().nullable(),
  captionEn: z.string().nullable(),
  credit: z.string().nullable(),
});
const articleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  status: z.enum(newsStatuses),
  titleHa: z.string(),
  titleEn: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: authorSchema,
  category: categorySchema,
  summaryHa: z.string(),
  bodyHa: z.string(),
  summaryEn: z.string().nullable(),
  bodyEn: z.string().nullable(),
  submittedForReviewAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  draftRevisionId: z.string().nullable().optional(),
  submittedRevisionId: z.string().nullable().optional(),
  publishedRevisionId: z.string().nullable().optional(),
  desk: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  priority: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isBreaking: z.boolean().optional(),
  publicUpdatedAt: z.string().nullable().optional(),
  assignedWriter: authorSchema.nullable().optional(),
  assignedReviewer: authorSchema.nullable().optional(),
  revisions: z.array(z.unknown()).optional(),
  contributors: z.array(z.unknown()).optional(),
  tags: z.array(z.unknown()).optional(),
  topics: z.array(z.unknown()).optional(),
  locations: z.array(z.unknown()).optional(),
  sources: z.array(z.unknown()).optional(),
  assignmentHistory: z.array(z.unknown()).optional(),
  featuredMedia: articleMediaProjectionSchema.nullable().optional(),
  socialMedia: z.object({ id: z.string() }).nullable().optional(),
  media: z
    .array(
      z.object({
        role: z.enum(['INLINE', 'GALLERY']),
        displayOrder: z.number(),
        media: articleMediaProjectionSchema,
      }),
    )
    .optional(),
  corrections: z
    .array(
      z.object({
        id: z.string(),
        noteHa: z.string(),
        noteEn: z.string().nullable(),
        createdAt: z.string(),
        createdBy: authorSchema,
      }),
    )
    .optional(),
  securityAdvisory: securityAdvisorySchema.nullable(),
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
const categoriesSchema = z.object({
  items: z.array(
    categorySchema.extend({
      descriptionHa: z.string().nullable(),
      descriptionEn: z.string().nullable(),
      displayOrder: z.number(),
      isActive: z.boolean(),
    }),
  ),
});
const eligibleAssigneesSchema = z.object({
  items: z.array(authorSchema.extend({ role: z.string() })),
});
const newsroomDashboardSchema = z.object({
  generatedAt: z.string(),
  myDrafts: z.number().int().nonnegative(),
  assignedToMe: z.number().int().nonnegative(),
  waitingForReview: z.number().int().nonnegative(),
  changesRequested: z.number().int().nonnegative(),
  readyToPublish: z.number().int().nonnegative(),
  publishedToday: z.number().int().nonnegative(),
});

export type NewsArticleList = NewsroomArticleListResponse;
export type NewsArticle = z.infer<typeof articleSchema>;
export type NewsHistory = z.infer<typeof historySchema>;
export type NewsCategories = z.infer<typeof categoriesSchema>;
export type NewsEligibleAssignees = z.infer<typeof eligibleAssigneesSchema>;
export type NewsroomDashboard = z.infer<typeof newsroomDashboardSchema>;
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
    category: first(parameters.category),
    severity: first(parameters.severity),
    view: first(parameters.view),
    desk: first(parameters.desk),
    priority: first(parameters.priority),
    language: first(parameters.language),
  };
  for (const [key, value] of Object.entries(changes)) values[key] = value?.toString();
  const query = new URLSearchParams();
  for (const key of [
    'page',
    'view',
    'status',
    'category',
    'severity',
    'desk',
    'priority',
    'language',
    'lang',
  ]) {
    if (values[key]) query.set(key, values[key]!);
  }
  const suffix = query.toString();
  return `/admin/news${suffix ? `?${suffix}` : ''}`;
}

export async function loadNewsArticles(parameters: AdminNewsSearchParams) {
  const query = new URLSearchParams();
  const page = first(parameters.page);
  const status = first(parameters.status);
  const category = first(parameters.category);
  const severity = first(parameters.severity);
  const view = first(parameters.view);
  const desk = first(parameters.desk);
  const priority = first(parameters.priority);
  const language = first(parameters.language);
  if (page) query.set('page', page);
  if (status) query.set('status', status);
  if (category) query.set('category', category);
  if (severity) query.set('severity', severity);
  if (view) query.set('view', view);
  if (desk) query.set('desk', desk);
  if (priority) query.set('priority', priority);
  if (language) query.set('language', language);
  return serverGet(`admin/news?${query}`, newsroomArticleListResponseSchema);
}

export async function loadNewsCategories() {
  return serverGet('admin/news/categories', categoriesSchema);
}

export async function loadNewsEligibleAssignees() {
  return serverGet('admin/news/eligible-assignees', eligibleAssigneesSchema);
}

export async function loadNewsroomDashboard() {
  return serverGet('admin/news/dashboard', newsroomDashboardSchema);
}

export async function loadNewsArticle(articleId: string) {
  return serverGet(`admin/news/${articleId}`, detailSchema);
}

export async function loadNewsPreview(articleId: string) {
  return serverGet(`admin/news/${articleId}/preview`, detailSchema);
}

export async function loadNewsHistory(articleId: string) {
  return serverGet(`admin/news/${articleId}/history`, historySchema);
}
