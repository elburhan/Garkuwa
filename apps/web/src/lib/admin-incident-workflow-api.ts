'use client';

import type { AdminIncidentStatus } from './admin-incidents-api';
import { webEnvironment } from './env';

export const allowedStatusTransitions: Readonly<
  Record<AdminIncidentStatus, readonly AdminIncidentStatus[]>
> = {
  NEW: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['ACTIONED', 'CLOSED', 'REJECTED'],
  ACTIONED: ['UNDER_REVIEW', 'CLOSED'],
  CLOSED: ['UNDER_REVIEW'],
  REJECTED: ['UNDER_REVIEW'],
};

export function statusTransitionRequiresReason(
  from: AdminIncidentStatus,
  to: AdminIncidentStatus,
): boolean {
  return to === 'REJECTED' || ((from === 'CLOSED' || from === 'REJECTED') && to === 'UNDER_REVIEW');
}

export type WorkflowMutationResult =
  | { kind: 'success' }
  | {
      kind:
        | 'validation'
        | 'unauthenticated'
        | 'forbidden'
        | 'not-found'
        | 'conflict'
        | 'rate-limit'
        | 'server'
        | 'network';
    };

async function mutate(path: string, body: object): Promise<WorkflowMutationResult> {
  try {
    const response = await fetch(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/${path}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (response.ok) return { kind: 'success' };
    if (response.status === 400) return { kind: 'validation' };
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 404) return { kind: 'not-found' };
    if (response.status === 409) return { kind: 'conflict' };
    if (response.status === 429) return { kind: 'rate-limit' };
    return { kind: 'server' };
  } catch {
    return { kind: 'network' };
  }
}

export function updateIncidentStatus(
  incidentId: string,
  input: { toStatus: AdminIncidentStatus; reason?: string; expectedUpdatedAt: string },
) {
  return mutate(`admin/incidents/${encodeURIComponent(incidentId)}/status`, input);
}

export function updateIncidentAssignment(
  incidentId: string,
  input: { assignedToUserId: string | null; reason?: string; expectedUpdatedAt: string },
) {
  return mutate(`admin/incidents/${encodeURIComponent(incidentId)}/assignment`, input);
}
