import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/env', () => ({
  webEnvironment: {
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

import {
  createPublicNewsArticleMetadata,
  createPublicNewsListMetadata,
} from '../src/lib/public-news-metadata';

const article = {
  slug: 'sanarwar-tsaro',
  title: 'Sanarwar Tsaro',
  summary: 'Taƙaitaccen bayanin sanarwar jama’a.',
  body: 'Cikakken bayani.',
  publishedAt: '2026-07-29T10:00:00.000Z',
  hasEnglishTranslation: false,
  category: { slug: 'news', name: 'Labarai' },
};

describe('public news metadata', () => {
  it('uses localized list canonicals and Hausa/English alternates', () => {
    expect(createPublicNewsListMetadata('en').alternates).toMatchObject({
      canonical: 'http://localhost:3000/en/news',
      languages: {
        ha: 'http://localhost:3000/news',
        en: 'http://localhost:3000/en/news',
      },
    });
  });

  it('keeps Hausa canonical detail and omits unavailable English alternate', () => {
    expect(createPublicNewsArticleMetadata('ha', article).alternates).toEqual({
      canonical: 'http://localhost:3000/news/sanarwar-tsaro',
      languages: { ha: 'http://localhost:3000/news/sanarwar-tsaro' },
    });
    expect(
      createPublicNewsArticleMetadata('en', {
        ...article,
        title: 'Safety notice',
        hasEnglishTranslation: true,
      }).alternates,
    ).toEqual({
      canonical: 'http://localhost:3000/news/sanarwar-tsaro',
      languages: {
        ha: 'http://localhost:3000/news/sanarwar-tsaro',
        en: 'http://localhost:3000/en/news/sanarwar-tsaro',
      },
    });
  });
});
