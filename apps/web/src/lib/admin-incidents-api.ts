import { cookies } from 'next/headers';
import { z } from 'zod';

import { staffSessionCookieName } from './admin-auth';
import { webEnvironment } from './env';

const roleWithIncidentAccess = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'ANALYST'] as const;
export const incidentViewerRoles = new Set<string>(roleWithIncidentAccess);

const categorySchema = z.object({ id: z.uuid(), nameHa: z.string(), nameEn: z.string() });
const staffSummarySchema = z.object({ id: z.uuid(), displayName: z.string() });
const assigneeSchema = staffSummarySchema.nullable();
const statusSchema = z.enum(['NEW', 'UNDER_REVIEW', 'ACTIONED', 'CLOSED', 'REJECTED']);
const severitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const languageSchema = z.enum(['ha', 'en']);

const queueItemSchema = z.object({
  id: z.uuid(),
  internalCaseId: z.string(),
  category: categorySchema,
  status: statusSchema,
  severity: severitySchema,
  submissionLanguage: languageSchema,
  state: z.string().nullable(),
  lga: z.string().nullable(),
  locationDescription: z.string().nullable(),
  incidentDate: z.string().nullable(),
  submittedAt: z.string(),
  assignedTo: assigneeSchema,
});

const queueResponseSchema = z.object({
  items: z.array(queueItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

const historySchema = z.object({
  fromStatus: statusSchema.nullable(),
  toStatus: statusSchema,
  changedAt: z.string(),
  changedBy: assigneeSchema,
  comment: z.string().nullable(),
});

const assignmentHistorySchema = z.object({
  fromUser: staffSummarySchema.nullable(),
  toUser: staffSummarySchema.nullable(),
  changedBy: staffSummarySchema,
  comment: z.string().nullable(),
  changedAt: z.string(),
});

const detailResponseSchema = z.object({
  incident: queueItemSchema.omit({ incidentDate: true }).extend({
    description: z.string(),
    incidentDate: z.string().nullable(),
    incidentTime: z.string().nullable(),
    latitude: z.string().nullable(),
    longitude: z.string().nullable(),
    duplicateOfIncidentId: z.string().nullable(),
    updatedAt: z.string(),
    closedAt: z.string().nullable(),
    statusHistory: z.array(historySchema),
    assignmentHistory: z.array(assignmentHistorySchema),
  }),
});

const eligibleAssigneesSchema = z.object({
  users: z.array(
    staffSummarySchema.extend({
      email: z.email(),
      role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MODERATOR']),
    }),
  ),
});

const contactAccessHistorySchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      reason: z.string(),
      accessedAt: z.string(),
      accessedBy: staffSummarySchema,
    }),
  ),
});

export type AdminIncidentQueue = z.infer<typeof queueResponseSchema>;
export type AdminIncidentQueueItem = z.infer<typeof queueItemSchema>;
export type AdminIncidentDetail = z.infer<typeof detailResponseSchema>['incident'];
export type AdminIncidentStatus = z.infer<typeof statusSchema>;
export type AdminIncidentSeverity = z.infer<typeof severitySchema>;
export type AdminSubmissionLanguage = z.infer<typeof languageSchema>;
export type EligibleAssignee = z.infer<typeof eligibleAssigneesSchema>['users'][number];
export type ContactAccessHistory = z.infer<typeof contactAccessHistorySchema>;

export type AdminApiResult<T> =
  | { kind: 'success'; data: T }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'not-found' }
  | { kind: 'error' };

const allowedQueryKeys = [
  'page',
  'pageSize',
  'status',
  'severity',
  'categoryId',
  'submissionLanguage',
  'state',
  'lga',
  'dateFrom',
  'dateTo',
  'search',
  'sort',
] as const;

export type AdminIncidentSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function buildAdminIncidentsSearch(
  parameters: AdminIncidentSearchParams,
  overrides: Record<string, string | number | undefined> = {},
): URLSearchParams {
  const result = new URLSearchParams();
  for (const key of allowedQueryKeys) {
    const value = Object.hasOwn(overrides, key) ? overrides[key] : firstValue(parameters[key]);
    if (value !== undefined && String(value).trim()) result.set(key, String(value));
  }
  return result;
}

export function buildAdminIncidentsPath(
  parameters: AdminIncidentSearchParams,
  overrides: Record<string, string | number | undefined> = {},
  locale: 'ha' | 'en' = 'ha',
): string {
  const query = buildAdminIncidentsSearch(parameters, overrides);
  query.set('lang', locale);
  return `/admin/incidents?${query.toString()}`;
}

async function authenticatedGet<T>(
  path: string,
  schema: z.ZodType<T>,
  fetcher: typeof fetch = fetch,
): Promise<AdminApiResult<T>> {
  const token = (await cookies()).get(staffSessionCookieName)?.value;
  if (!token) return { kind: 'unauthenticated' };

  try {
    const response = await fetcher(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/${path}`,
      {
        headers: { Accept: 'application/json', Cookie: `${staffSessionCookieName}=${token}` },
        cache: 'no-store',
      },
    );
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

export function loadAdminIncidentQueue(parameters: AdminIncidentSearchParams) {
  const query = buildAdminIncidentsSearch(parameters);
  return authenticatedGet(`admin/incidents?${query.toString()}`, queueResponseSchema);
}

export function loadAdminIncidentDetail(incidentId: string) {
  return authenticatedGet(
    `admin/incidents/${encodeURIComponent(incidentId)}`,
    detailResponseSchema,
  );
}

export function loadEligibleAssignees() {
  return authenticatedGet('admin/incidents/eligible-assignees', eligibleAssigneesSchema);
}

export function loadContactAccessHistory(incidentId: string) {
  return authenticatedGet(
    `admin/incidents/${encodeURIComponent(incidentId)}/contact-access-history`,
    contactAccessHistorySchema,
  );
}
