import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/env', () => ({
  webEnvironment: {
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

import {
  loadPublicNews,
  loadPublicNewsArticle,
  parsePublicNewsPage,
} from '../src/lib/public-news-api';

const item = {
  slug: 'sanarwar-tsaro',
  title: 'Sanarwar Tsaro',
  summary: 'Taƙaitaccen bayanin sanarwar jama’a.',
  publishedAt: '2026-07-29T10:00:00.000Z',
  hasEnglishTranslation: true,
  category: { slug: 'news', name: 'Labarai' },
};

describe('public news API client', () => {
  it('validates page input without coercing unsafe values', () => {
    expect(parsePublicNewsPage(undefined)).toBe(1);
    expect(parsePublicNewsPage('2')).toBe(2);
    expect(parsePublicNewsPage('0')).toBeNull();
    expect(parsePublicNewsPage('-1')).toBeNull();
    expect(parsePublicNewsPage(['1', '2'])).toBeNull();
  });

  it('loads bounded localized lists through revalidated public requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          generatedAt: '2026-07-29T12:00:00.000Z',
          items: [item],
          pagination: { page: 2, pageSize: 3, totalItems: 4, totalPages: 2 },
        }),
        { status: 200 },
      ),
    );
    await expect(loadPublicNews('en', { page: 2, pageSize: 3, fetcher })).resolves.toEqual({
      kind: 'success',
      data: {
        generatedAt: '2026-07-29T12:00:00.000Z',
        items: [item],
        pagination: { page: 2, pageSize: 3, totalItems: 4, totalPages: 2 },
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:4000/api/public/news?lang=en&page=2&pageSize=3',
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it('maps hidden detail to not-found without consuming internal error bodies', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('unpublished internal detail', { status: 404 }));
    await expect(loadPublicNewsArticle('hidden-slug', 'en', fetcher)).resolves.toEqual({
      kind: 'not-found',
    });
  });
});
