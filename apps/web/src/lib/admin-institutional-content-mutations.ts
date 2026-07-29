'use client';

import { webEnvironment } from './env';

export type InstitutionalMutationResult =
  | { kind: 'success' }
  | {
      kind: 'unauthenticated' | 'forbidden' | 'validation' | 'conflict' | 'rate-limit' | 'error';
    };

async function mutate(path: string, body: unknown): Promise<InstitutionalMutationResult> {
  try {
    const base = webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '');
    const response = await fetch(`${base}/${path}`, {
      method: 'PATCH',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 400) return { kind: 'validation' };
    if (response.status === 409) return { kind: 'conflict' };
    if (response.status === 429) return { kind: 'rate-limit' };
    return response.ok ? { kind: 'success' } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

export const saveInstitutionalDraft = (
  pageKey: string,
  input: Record<string, unknown>,
  expectedUpdatedAt: string,
) =>
  mutate(`admin/institutional-pages/${pageKey}/draft`, {
    ...input,
    expectedUpdatedAt,
  });

export const transitionInstitutionalPage = (
  pageKey: string,
  decision: 'SUBMIT_FOR_REVIEW' | 'RETURN_TO_DRAFT' | 'PUBLISH',
  expectedUpdatedAt: string,
  reason?: string,
) =>
  mutate(`admin/institutional-pages/${pageKey}/status`, {
    decision,
    expectedUpdatedAt,
    ...(reason ? { reason } : {}),
  });
