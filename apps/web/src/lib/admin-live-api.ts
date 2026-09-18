import { z } from 'zod';

import { webEnvironment } from './env';

const actorSchema = z.object({ id: z.string(), displayName: z.string() });
export const adminLiveEventSchema = z.object({
  id: z.string(),
  slug: z.string(),
  titleHa: z.string(),
  titleEn: z.string().nullable(),
  summaryHa: z.string().nullable(),
  summaryEn: z.string().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED']),
  isFeatured: z.boolean(),
  startedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  category: z.object({
    code: z.string(),
    slug: z.string(),
    nameHa: z.string(),
    nameEn: z.string().nullable(),
  }),
  featuredMediaId: z.string().nullable(),
  createdBy: actorSchema,
});
export const adminLiveUpdateSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  headlineHa: z.string().nullable(),
  headlineEn: z.string().nullable(),
  bodyHa: z.string(),
  bodyEn: z.string().nullable(),
  isRetracted: z.boolean(),
  isPinned: z.boolean(),
  correctedAt: z.string().nullable(),
  withdrawnAt: z.string().nullable(),
  withdrawalReason: z.string().nullable(),
  mediaId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: actorSchema,
  revisions: z.array(
    z.object({
      id: z.string(),
      headlineHa: z.string().nullable(),
      headlineEn: z.string().nullable(),
      bodyHa: z.string(),
      bodyEn: z.string().nullable(),
      reason: z.string(),
      createdAt: z.string(),
      createdBy: actorSchema,
    }),
  ),
});
export const adminLiveEventListSchema = z.object({
  items: z.array(adminLiveEventSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export const adminLiveEventDetailSchema = z.object({
  event: adminLiveEventSchema,
  updates: z.array(adminLiveUpdateSchema),
  operations: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      createdAt: z.string(),
      actor: actorSchema,
    }),
  ),
});
export type AdminLiveEvent = z.infer<typeof adminLiveEventSchema>;
export type AdminLiveUpdate = z.infer<typeof adminLiveUpdateSchema>;
export type AdminLiveEventList = z.infer<typeof adminLiveEventListSchema>;
export type AdminLiveEventDetail = z.infer<typeof adminLiveEventDetailSchema>;

type ActionResult =
  | { kind: 'success'; data: unknown }
  | { kind: 'conflict' | 'forbidden' | 'unauthenticated' | 'error' };

async function post(path: string, body: unknown): Promise<ActionResult> {
  try {
    const response = await fetch(`${webEnvironment.NEXT_PUBLIC_API_BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 409) return { kind: 'conflict' };
    if (!response.ok) return { kind: 'error' };
    return { kind: 'success', data: (await response.json()) as unknown };
  } catch {
    return { kind: 'error' };
  }
}

async function patch(path: string, body: unknown): Promise<ActionResult> {
  try {
    const response = await fetch(`${webEnvironment.NEXT_PUBLIC_API_BASE_URL}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 409) return { kind: 'conflict' };
    if (!response.ok) return { kind: 'error' };
    return { kind: 'success', data: (await response.json()) as unknown };
  } catch {
    return { kind: 'error' };
  }
}

export function createLiveEvent(body: {
  categoryCode: string;
  titleHa: string;
  titleEn: string | null;
  summaryHa: string | null;
  summaryEn: string | null;
}) {
  return post('/admin/live', body);
}

export function addLiveUpdate(
  eventId: string,
  body: {
    headlineHa: string | null;
    headlineEn: string | null;
    bodyHa: string;
    bodyEn: string | null;
    mediaId: string | null;
    clientSubmissionId: string;
  },
) {
  return post(`/admin/live/${eventId}/updates`, body);
}

export function updateLiveEventMetadata(
  eventId: string,
  body: {
    categoryCode: string;
    titleHa: string;
    titleEn: string | null;
    summaryHa: string | null;
    summaryEn: string | null;
    featuredMediaId: string | null;
    expectedUpdatedAt: string;
  },
) {
  return patch(`/admin/live/${eventId}`, body);
}

export function pinLiveUpdate(
  eventId: string,
  updateId: string,
  isPinned: boolean,
  expectedUpdatedAt: string,
) {
  return patch(`/admin/live/${eventId}/updates/${updateId}/pin`, { isPinned, expectedUpdatedAt });
}

export function correctLiveUpdate(
  eventId: string,
  updateId: string,
  body: Record<string, unknown>,
) {
  return patch(`/admin/live/${eventId}/updates/${updateId}/correct`, body);
}

export function withdrawLiveUpdate(
  eventId: string,
  updateId: string,
  reason: string,
  expectedUpdatedAt: string,
) {
  return patch(`/admin/live/${eventId}/updates/${updateId}/withdraw`, {
    reason,
    expectedUpdatedAt,
  });
}

export function updateLiveEventPublishing(
  eventId: string,
  body: {
    action: 'START' | 'CLOSE' | 'REOPEN' | 'ARCHIVE';
    isFeatured: boolean;
    expectedUpdatedAt: string;
  },
) {
  return patch(`/admin/live/${eventId}/publishing`, body);
}
