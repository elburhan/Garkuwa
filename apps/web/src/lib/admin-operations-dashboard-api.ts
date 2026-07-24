import { cookies } from 'next/headers';
import { z } from 'zod';

import { staffSessionCookieName } from './admin-auth';
import { webEnvironment } from './env';

export const dashboardRanges = ['7d', '30d', '90d'] as const;
export type DashboardRange = (typeof dashboardRanges)[number];

const statusSchema = z.enum(['NEW', 'UNDER_REVIEW', 'ACTIONED', 'CLOSED', 'REJECTED']);
const severitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const staffSchema = z.object({ id: z.uuid(), displayName: z.string() });
const incidentSchema = z.object({ id: z.uuid(), internalCaseId: z.string() });

const operationsDashboardSchema = z.object({
  generatedAt: z.string(),
  range: z.object({
    key: z.enum(dashboardRanges),
    from: z.string(),
    to: z.string(),
  }),
  overview: z.object({
    totalIncidents: z.number().int().nonnegative(),
    newIncidents: z.number().int().nonnegative(),
    underReviewIncidents: z.number().int().nonnegative(),
    unassignedIncidents: z.number().int().nonnegative(),
    openIncidents: z.number().int().nonnegative(),
    closedIncidents: z.number().int().nonnegative(),
    rejectedIncidents: z.number().int().nonnegative(),
  }),
  statusDistribution: z.array(
    z.object({ status: statusSchema, count: z.number().int().nonnegative() }),
  ),
  severityDistribution: z.array(
    z.object({
      severity: severitySchema,
      count: z.number().int().nonnegative(),
    }),
  ),
  submissionTrend: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      count: z.number().int().nonnegative(),
    }),
  ),
  assignmentWorkload: z.array(
    z.object({
      staff: staffSchema,
      activeIncidentCount: z.number().int().nonnegative(),
    }),
  ),
  attachmentReviewWorkload: z.object({
    quarantined: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }),
  recentActivity: z.array(
    z.object({
      type: z.enum([
        'INCIDENT_SUBMITTED',
        'STATUS_CHANGED',
        'ASSIGNMENT_CHANGED',
        'ATTACHMENT_REVIEWED',
      ]),
      occurredAt: z.string(),
      incident: incidentSchema,
      actor: staffSchema.nullable(),
      summary: z.object({
        fromStatus: statusSchema.nullable().optional(),
        toStatus: statusSchema.nullable().optional(),
        fromAssigneeDisplayName: z.string().nullable().optional(),
        toAssigneeDisplayName: z.string().nullable().optional(),
        attachmentDecision: z.enum(['QUARANTINED', 'AVAILABLE', 'REJECTED']).optional(),
      }),
    }),
  ),
});

export type OperationsDashboard = z.infer<typeof operationsDashboardSchema>;

export type OperationsDashboardResult =
  | { kind: 'success'; data: OperationsDashboard }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'invalid-range' }
  | { kind: 'error' };

export function normalizeDashboardRange(value: string | undefined): DashboardRange {
  return dashboardRanges.includes(value as DashboardRange) ? (value as DashboardRange) : '30d';
}

export function dashboardPath(locale: 'ha' | 'en', range: DashboardRange): string {
  const query = new URLSearchParams({ lang: locale, range });
  return `/admin?${query.toString()}`;
}

export async function loadOperationsDashboard(
  range: DashboardRange,
  fetcher: typeof fetch = fetch,
): Promise<OperationsDashboardResult> {
  const token = (await cookies()).get(staffSessionCookieName)?.value;
  if (!token) return { kind: 'unauthenticated' };

  try {
    const response = await fetcher(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/admin/dashboard/operations?range=${range}`,
      {
        headers: {
          Accept: 'application/json',
          Cookie: `${staffSessionCookieName}=${token}`,
        },
        cache: 'no-store',
      },
    );
    if (response.status === 400) return { kind: 'invalid-range' };
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (!response.ok) return { kind: 'error' };
    const parsed = operationsDashboardSchema.safeParse(await response.json());
    return parsed.success ? { kind: 'success', data: parsed.data } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}
