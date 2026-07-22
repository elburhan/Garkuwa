import { z } from 'zod';

import type { IncidentSubmissionPayload } from './incident-report-schema';

const categorySchema = z.object({
  id: z.uuid(),
  nameHa: z.string(),
  nameEn: z.string(),
  descriptionHa: z.string().nullable(),
  descriptionEn: z.string().nullable(),
});

const categoriesResponseSchema = z.object({ categories: z.array(categorySchema) });

export type PublicIncidentCategory = z.infer<typeof categorySchema>;
export type PublicApiErrorKind =
  | 'validation'
  | 'payload-too-large'
  | 'unsupported-media'
  | 'rate-limit'
  | 'network'
  | 'timeout'
  | 'server';

export class PublicApiError extends Error {
  constructor(readonly kind: PublicApiErrorKind) {
    super(kind);
    this.name = 'PublicApiError';
  }
}

export function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function apiUrl(baseUrl: string, path: string): string {
  return `${normalizeApiBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`;
}

export async function loadIncidentCategories(
  baseUrl: string,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<PublicIncidentCategory[]> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(apiUrl(baseUrl, 'public/incident-categories'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });
  } catch {
    throw new PublicApiError(options.signal?.aborted ? 'timeout' : 'network');
  }

  if (!response.ok) throw new PublicApiError('server');
  try {
    return categoriesResponseSchema.parse(await response.json()).categories;
  } catch {
    throw new PublicApiError('server');
  }
}

function errorKindForStatus(status: number): PublicApiErrorKind {
  if (status === 400) return 'validation';
  if (status === 413) return 'payload-too-large';
  if (status === 415) return 'unsupported-media';
  if (status === 429) return 'rate-limit';
  return 'server';
}

export async function submitIncidentReport(
  baseUrl: string,
  payload: IncidentSubmissionPayload,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);

  try {
    const response = await fetcher(apiUrl(baseUrl, 'public/incidents'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new PublicApiError(errorKindForStatus(response.status));
  } catch (error) {
    if (error instanceof PublicApiError) throw error;
    throw new PublicApiError(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timeout);
  }
}
