import { cookies } from 'next/headers';
import { z } from 'zod';

import { staffSessionCookieName } from './admin-auth';
import { webEnvironment } from './env';
import { institutionalPageKeys } from './public-institutional-content-api';

export const institutionalWorkflowStatuses = ['DRAFT', 'IN_REVIEW', 'PUBLISHED'] as const;
const actorSchema = z.object({ id: z.string(), displayName: z.string() }).nullable();
const sectionSchema = z.object({
  sectionKey: z.string(),
  headingHa: z.string(),
  bodyHa: z.string(),
  headingEn: z.string().nullable(),
  bodyEn: z.string().nullable(),
});
const revisionSchema = z.object({
  id: z.string(),
  version: z.number(),
  titleHa: z.string(),
  summaryHa: z.string().nullable(),
  titleEn: z.string().nullable(),
  summaryEn: z.string().nullable(),
  sections: z.array(sectionSchema),
  createdAt: z.string(),
  createdBy: actorSchema,
  englishComplete: z.boolean(),
});
const listSchema = z.object({
  items: z.array(
    z.object({
      pageKey: z.enum(institutionalPageKeys),
      routes: z.object({ ha: z.string(), en: z.string() }),
      workflowStatus: z.enum(institutionalWorkflowStatuses),
      draftVersion: z.number().nullable(),
      publishedVersion: z.number().nullable(),
      updatedAt: z.string(),
      publishedAt: z.string().nullable(),
    }),
  ),
});
const detailSchema = z.object({
  page: z.object({
    pageKey: z.enum(institutionalPageKeys),
    routes: z.object({ ha: z.string(), en: z.string() }),
    workflowStatus: z.enum(institutionalWorkflowStatuses),
    updatedAt: z.string(),
    publishedAt: z.string().nullable(),
    draftRevision: revisionSchema.nullable(),
    publishedRevision: revisionSchema.nullable(),
    allowedActions: z.object({
      saveDraft: z.boolean(),
      submit: z.boolean(),
      return: z.boolean(),
      publish: z.boolean(),
    }),
  }),
});
const revisionsSchema = z.object({
  items: z.array(revisionSchema.extend({ isDraft: z.boolean(), isPublished: z.boolean() })),
});
const historySchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      fromStatus: z.enum(institutionalWorkflowStatuses).nullable(),
      toStatus: z.enum(institutionalWorkflowStatuses),
      reason: z.string().nullable(),
      createdAt: z.string(),
      revision: z.object({ version: z.number() }),
      actor: actorSchema,
    }),
  ),
});

export type InstitutionalPageList = z.infer<typeof listSchema>;
export type InstitutionalPageDetail = z.infer<typeof detailSchema>['page'];
export type InstitutionalRevision = z.infer<typeof revisionSchema>;
export type InstitutionalRevisions = z.infer<typeof revisionsSchema>;
export type InstitutionalHistory = z.infer<typeof historySchema>;
export type InstitutionalApiResult<T> =
  { kind: 'success'; data: T } | { kind: 'unauthenticated' | 'forbidden' | 'not-found' | 'error' };

function apiUrl(path: string) {
  return `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/${path}`;
}

async function serverGet<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<InstitutionalApiResult<T>> {
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
    const result = schema.safeParse(await response.json());
    return result.success ? { kind: 'success', data: result.data } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

export const loadInstitutionalPages = () => serverGet('admin/institutional-pages', listSchema);
export const loadInstitutionalPage = (pageKey: string) =>
  serverGet(`admin/institutional-pages/${pageKey}`, detailSchema);
export const loadInstitutionalRevisions = (pageKey: string) =>
  serverGet(`admin/institutional-pages/${pageKey}/revisions`, revisionsSchema);
export const loadInstitutionalHistory = (pageKey: string) =>
  serverGet(`admin/institutional-pages/${pageKey}/history`, historySchema);
