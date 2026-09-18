import { webEnvironment } from './env';
import type { NewsroomAssignmentUpdate, NewsroomWorkflowAction } from '@garkuwa/contracts/newsroom';
import type {
  ArticleCorrectionInput,
  ArticleMediaUpdate,
  ArticlePublishingMetadata,
} from '@garkuwa/contracts/media';

export type NewsDecision = NewsroomWorkflowAction['decision'];

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

export const createNewsArticle = (content: Record<string, unknown>) =>
  mutate('admin/news', 'POST', content);

export const updateNewsArticle = (
  articleId: string,
  content: Record<string, unknown>,
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

export const assignNewsArticle = (articleId: string, assignment: NewsroomAssignmentUpdate) =>
  mutate(`admin/news/${articleId}/assignment`, 'PATCH', assignment);

export const updateNewsMetadata = (
  articleId: string,
  metadata: Record<string, unknown>,
  expectedUpdatedAt: string,
) => mutate(`admin/news/${articleId}/metadata`, 'PATCH', { ...metadata, expectedUpdatedAt });

export const updateNewsArticleMedia = (articleId: string, media: ArticleMediaUpdate) =>
  mutate(`admin/news/${articleId}/media`, 'PATCH', media);

export const updateNewsPublishingMetadata = (
  articleId: string,
  metadata: ArticlePublishingMetadata,
) => mutate(`admin/news/${articleId}/publishing-metadata`, 'PATCH', metadata);

export const addNewsCorrection = (articleId: string, correction: ArticleCorrectionInput) =>
  mutate(`admin/news/${articleId}/corrections`, 'POST', correction);
