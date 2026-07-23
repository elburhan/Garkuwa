'use client';

import { z } from 'zod';

import { webEnvironment } from './env';

export type NoteApiResult<T = undefined> =
  | { kind: 'success'; data: T }
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

const revisionsSchema = z.object({
  items: z.array(
    z.object({
      revisionNumber: z.number().int().positive(),
      body: z.string(),
      changeReason: z.string().nullable(),
      changedAt: z.string(),
      changedBy: z.object({ id: z.uuid(), displayName: z.string() }),
    }),
  ),
});
export type NoteRevisions = z.infer<typeof revisionsSchema>;

function mapStatus(status: number): Exclude<NoteApiResult, { kind: 'success' }>['kind'] {
  if (status === 400) return 'validation';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate-limit';
  return 'server';
}

async function mutate(
  path: string,
  method: 'POST' | 'PATCH',
  body: object,
): Promise<NoteApiResult> {
  try {
    const response = await fetch(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/${path}`,
      {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    return response.ok
      ? { kind: 'success', data: undefined }
      : { kind: mapStatus(response.status) };
  } catch {
    return { kind: 'network' };
  }
}

export function createIncidentNote(incidentId: string, body: string) {
  return mutate(`admin/incidents/${encodeURIComponent(incidentId)}/notes`, 'POST', { body });
}

export function editIncidentNote(
  incidentId: string,
  noteId: string,
  input: { body: string; reason?: string; expectedVersion: number },
) {
  return mutate(
    `admin/incidents/${encodeURIComponent(incidentId)}/notes/${encodeURIComponent(noteId)}`,
    'PATCH',
    input,
  );
}

export function redactIncidentNote(
  incidentId: string,
  noteId: string,
  input: { reason: string; expectedVersion: number },
) {
  return mutate(
    `admin/incidents/${encodeURIComponent(incidentId)}/notes/${encodeURIComponent(noteId)}/redact`,
    'POST',
    input,
  );
}

export async function loadNoteRevisions(
  incidentId: string,
  noteId: string,
): Promise<NoteApiResult<NoteRevisions>> {
  try {
    const response = await fetch(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/admin/incidents/${encodeURIComponent(incidentId)}/notes/${encodeURIComponent(noteId)}/revisions`,
      { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return { kind: mapStatus(response.status) };
    const parsed = revisionsSchema.safeParse(await response.json());
    return parsed.success ? { kind: 'success', data: parsed.data } : { kind: 'server' };
  } catch {
    return { kind: 'network' };
  }
}
