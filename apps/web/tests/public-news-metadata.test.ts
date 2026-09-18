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
  updatedAt: '2026-07-29T10:00:00.000Z',
  isFeatured: false,
  isBreaking: false,
  featuredMedia: null,
  socialMedia: null,
  bodyBlocks: null,
  gallery: [],
  corrections: [],
  hasEnglishTranslation: false,
  category: { slug: 'news', name: 'Labarai' },
  securityAdvisory: null,
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

  it('uses locale-specific article canonicals and only advertises available translations', () => {
    expect(createPublicNewsArticleMetadata('ha', article).alternates).toEqual({
      canonical: 'http://localhost:3000/news/sanarwar-tsaro',
      languages: { ha: 'http://localhost:3000/news/sanarwar-tsaro' },
    });
    expect(createPublicNewsArticleMetadata('en', article).alternates).toEqual({
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
      canonical: 'http://localhost:3000/en/news/sanarwar-tsaro',
      languages: {
        ha: 'http://localhost:3000/news/sanarwar-tsaro',
        en: 'http://localhost:3000/en/news/sanarwar-tsaro',
      },
    });
  });

  it('uses the localized featured image for Open Graph and the site fallback otherwise', () => {
    const fallback = createPublicNewsArticleMetadata('ha', article).openGraph;
    expect(fallback && 'images' in fallback ? fallback.images : null).toEqual([
      expect.objectContaining({ url: 'http://localhost:3000/default-news-social.svg' }),
    ]);

    const featured = createPublicNewsArticleMetadata('en', {
      ...article,
      title: 'Safety notice',
      hasEnglishTranslation: true,
      featuredMedia: {
        id: '52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
        url: '/api/public/news/media/52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
        mimeType: 'image/jpeg',
        width: 1200,
        height: 675,
        altText: 'Floodwater covering a city road',
        caption: 'Floodwater along the road',
        credit: 'Staff photo',
      },
    }).openGraph;
    expect(featured).toMatchObject({
      url: 'http://localhost:3000/en/news/sanarwar-tsaro',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: [
        expect.objectContaining({
          url: 'http://localhost:4000/api/public/news/media/52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
          alt: 'Floodwater covering a city road',
        }),
      ],
    });
  });
});
