import { webEnvironment } from './env';

export type NewsDecision =
  'SUBMIT_FOR_REVIEW' | 'RETURN_TO_DRAFT' | 'APPROVE_PUBLICATION' | 'ARCHIVE';

export type NewsMutationResult =
  | { kind: 'success'; data: unknown }
  | {
      kind:
        | 'unauthenticated'
        | 'forbidden'
        | 'not-found'
        | 'validation'
        | 'conflict'
        | 'rate-limit'
        | 'error';
    };

function apiUrl(path: string): string {
  return `${webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/${path}`;
}

async function mutate(
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown,
): Promise<NewsMutationResult> {
  try {
    const response = await fetch(apiUrl(path), {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 400) return { kind: 'validation' };
    if (response.status === 404) return { kind: 'not-found' };
    if (response.status === 409) return { kind: 'conflict' };
    if (response.status === 429) return { kind: 'rate-limit' };
    if (!response.ok) return { kind: 'error' };
    return { kind: 'success', data: await response.json() };
  } catch {
    return { kind: 'error' };
  }
}

export const createNewsArticle = (content: Record<string, string | null>) =>
  mutate('admin/news', 'POST', content);

export const updateNewsArticle = (
  articleId: string,
  content: Record<string, string | null>,
  expectedUpdatedAt: string,
) => mutate(`admin/news/${articleId}`, 'PATCH', { ...content, expectedUpdatedAt });

export const transitionNewsArticle = (
  articleId: string,
  decision: NewsDecision,
  expectedUpdatedAt: string,
  reason?: string,
) =>
  mutate(`admin/news/${articleId}/status`, 'PATCH', {
    decision,
    expectedUpdatedAt,
    ...(reason ? { reason } : {}),
  });
