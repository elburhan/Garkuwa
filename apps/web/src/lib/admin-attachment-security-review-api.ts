'use client';

import { webEnvironment } from './env';

export type AttachmentSecurityReviewResult =
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

export async function submitAttachmentSecurityReview(
  incidentId: string,
  attachmentId: string,
  input: {
    decision: 'AVAILABLE' | 'REJECTED';
    reason: string;
    expectedUpdatedAt: string;
  },
): Promise<AttachmentSecurityReviewResult> {
  try {
    const response = await fetch(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/admin/incidents/${encodeURIComponent(incidentId)}/attachments/${encodeURIComponent(attachmentId)}/security-review`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
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
