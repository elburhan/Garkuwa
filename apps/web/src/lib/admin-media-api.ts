import { z } from 'zod';

import { webEnvironment } from './env';

const personSchema = z.object({ id: z.string(), displayName: z.string() });
export const adminMediaSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  mediaType: z.string(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  provenance: z.string(),
  altTextHa: z.string(),
  altTextEn: z.string().nullable(),
  captionHa: z.string().nullable(),
  captionEn: z.string().nullable(),
  credit: z.string().nullable(),
  source: z.string().nullable(),
  rightsNotes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  uploadedBy: personSchema,
});
export const adminMediaListSchema = z.object({
  items: z.array(adminMediaSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminMedia = z.infer<typeof adminMediaSchema>;
export type AdminMediaList = z.infer<typeof adminMediaListSchema>;

export function adminMediaContentUrl(mediaId: string): string {
  return `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/admin/media/${mediaId}/content`;
}

export async function uploadAdminMedia(form: FormData) {
  try {
    const response = await fetch(`${webEnvironment.NEXT_PUBLIC_API_BASE_URL}/admin/media`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      body: form,
    });
    if (response.status === 401) return { kind: 'unauthenticated' as const };
    if (response.status === 403) return { kind: 'forbidden' as const };
    if (!response.ok) return { kind: 'error' as const };
    return { kind: 'success' as const, data: (await response.json()) as unknown };
  } catch {
    return { kind: 'error' as const };
  }
}

export async function archiveAdminMedia(mediaId: string, expectedUpdatedAt: string) {
  try {
    const response = await fetch(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL}/admin/media/${mediaId}/archive`,
      {
        method: 'PATCH',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ expectedUpdatedAt }),
      },
    );
    return response.ok ? { kind: 'success' as const } : { kind: 'error' as const };
  } catch {
    return { kind: 'error' as const };
  }
}

export async function updateAdminMedia(mediaId: string, body: Record<string, unknown>) {
  try {
    const response = await fetch(
      `${webEnvironment.NEXT_PUBLIC_API_BASE_URL}/admin/media/${mediaId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (response.status === 409) return { kind: 'conflict' as const };
    return response.ok ? { kind: 'success' as const } : { kind: 'error' as const };
  } catch {
    return { kind: 'error' as const };
  }
}
