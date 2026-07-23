'use client';

import { z } from 'zod';

import { webEnvironment } from './env';

const responseSchema = z.object({
  contact: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    preferredContactMethod: z.enum(['PHONE', 'EMAIL']),
    safeContactInstructions: z.string().nullable(),
    consentToContact: z.boolean(),
  }),
  access: z.object({ accessedAt: z.string() }),
});

export type RevealedContact = z.infer<typeof responseSchema>;
export type ContactAccessResult =
  | { kind: 'success'; data: RevealedContact }
  | {
      kind:
        | 'validation'
        | 'unauthenticated'
        | 'forbidden'
        | 'not-found'
        | 'rate-limit'
        | 'server'
        | 'network';
    };

export async function revealIncidentContact(
  incidentId: string,
  reason: string,
): Promise<ContactAccessResult> {
  try {
    const response = await fetch(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/admin/incidents/${encodeURIComponent(incidentId)}/contact-access`,
      {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      },
    );
    if (response.status === 400) return { kind: 'validation' };
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 404) return { kind: 'not-found' };
    if (response.status === 429) return { kind: 'rate-limit' };
    if (!response.ok) return { kind: 'server' };
    const parsed = responseSchema.safeParse(await response.json());
    return parsed.success ? { kind: 'success', data: parsed.data } : { kind: 'server' };
  } catch {
    return { kind: 'network' };
  }
}
