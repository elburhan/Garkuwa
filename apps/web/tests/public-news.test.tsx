// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/env', () => ({
  webEnvironment: {
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

import { PublicHome } from '../src/components/public/public-home';
import { PublicNewsArticle } from '../src/components/public/public-news-article';
import { PublicNewsListPage } from '../src/components/public/public-news-list';
import type { PublicNewsDetail, PublicNewsList } from '../src/lib/public-news-api';

const publishedAt = '2026-07-29T10:00:00.000Z';
const list: PublicNewsList = {
  generatedAt: '2026-07-29T12:00:00.000Z',
  items: [
    {
      slug: 'sanarwar-tsaro',
      title: 'Sanarwar Tsaro',
      summary: 'Taƙaitaccen bayanin sanarwar jama’a.',
      publishedAt,
      updatedAt: publishedAt,
      isFeatured: false,
      isBreaking: false,
      featuredMedia: null,
      hasEnglishTranslation: true,
      category: { slug: 'news', name: 'Labarai' },
      securityAdvisory: null,
    },
  ],
  pagination: { page: 2, pageSize: 10, totalItems: 21, totalPages: 3 },
};
const detail: PublicNewsDetail = {
  ...list.items[0]!,
  socialMedia: null,
  body: 'Sakin layi na farko.\n\nSakin layi na biyu.',
  bodyBlocks: null,
  gallery: [],
  corrections: [],
  securityAdvisory: null,
};

afterEach(cleanup);

describe('public news delivery', () => {
  it('renders a semantic Hausa list with dates and language-preserving pagination', () => {
    const { container } = render(<PublicNewsListPage locale="ha" news={list} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tabbatattun labarai da sanarwa' }),
    ).toBeTruthy();
    expect(container.querySelectorAll('article')).toHaveLength(1);
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(publishedAt);
    expect(screen.getByRole('link', { name: 'Shafin baya' }).getAttribute('href')).toBe('/news');
    expect(screen.getByRole('link', { name: 'Shafi na gaba' }).getAttribute('href')).toBe(
      '/news?page=3',
    );
    expect(screen.getByRole('link', { name: 'Rubutun Turanci' }).getAttribute('href')).toBe(
      '/en/news?page=2',
    );
  });

  it('renders structured advisory text and hardened external references without HTML interpretation', () => {
    const { container } = render(
      <PublicNewsArticle
        locale="ha"
        article={{
          ...detail,
          category: { slug: 'security-advisories', name: 'Shawarwarin tsaro' },
          securityAdvisory: {
            severity: 'HIGH',
            affectedArea: '<script>ba a aiwatar ba</script>\n\nMasu amfani da tsohon tsari.',
            recommendedActions: 'A sabunta tsarin.\n\nA tabbatar da tushen sanarwa.',
            references: [{ label: 'Tushen hukuma', url: 'https://example.org/advisory' }],
          },
        }}
      />,
    );
    expect(screen.getByText('Mai tsanani')).toBeTruthy();
    expect(container.textContent).toContain('<script>ba a aiwatar ba</script>');
    expect(container.querySelector('script')).toBeNull();
    const reference = screen.getByRole('link', { name: /Tushen hukuma/ });
    expect(reference.getAttribute('target')).toBe('_blank');
    expect(reference.getAttribute('rel')).toContain('noopener');
    expect(reference.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('renders only supplied English content and links safely back to canonical Hausa', () => {
    render(
      <PublicNewsArticle
        locale="en"
        article={{
          ...detail,
          title: 'Safety notice',
          summary: 'A concise public safety notice.',
          body: 'First paragraph.\n\nSecond paragraph.',
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Safety notice' })).toBeTruthy();
    expect(screen.queryByText('Sanarwar Tsaro')).toBeNull();
    expect(screen.getByRole('link', { name: 'Hausa version' }).getAttribute('href')).toBe(
      '/news/sanarwar-tsaro',
    );
    expect(screen.queryByText(/author|reviewer|status|history/i)).toBeNull();
  });

  it('preserves plain-text paragraphs and suppresses broken English links when unavailable', () => {
    const { container } = render(
      <PublicNewsArticle
        locale="ha"
        article={{ ...detail, hasEnglishTranslation: false, body: '<b>Ba HTML ba</b>\n\nNa biyu.' }}
      />,
    );
    expect(container.querySelector('.article-body')?.querySelectorAll('p')).toHaveLength(2);
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<b>Ba HTML ba</b>')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Rubutun Turanci' })).toBeNull();
    expect(screen.getByText(/Ba a samar da cikakken fassarar Turanci/)).toBeTruthy();
  });

  it('renders featured, inline and gallery images with editorial accessibility metadata', () => {
    const image = {
      id: '52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
      url: '/api/public/news/media/52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
      mimeType: 'image/jpeg' as const,
      width: 640,
      height: 360,
      altText: 'Ruwan sama ya rufe wani ɓangaren hanya',
      caption: 'Ruwa a kan hanyar birni',
      credit: 'Hoton ma’aikaci',
    };
    render(
      <PublicNewsArticle
        locale="ha"
        article={{
          ...detail,
          isBreaking: true,
          featuredMedia: image,
          bodyBlocks: [{ type: 'image', mediaId: image.id }],
          gallery: [
            { displayOrder: 0, media: { ...image, id: '62fc7e20-ab06-4f7c-8d3c-15f075275fd3' } },
          ],
          corrections: [
            {
              id: '72fc7e20-ab06-4f7c-8d3c-15f075275fd3',
              note: 'An gyara lokacin da aka ambata a baya.',
              createdAt: '2026-09-15T11:00:00.000Z',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Labarin gaggawa')).toBeTruthy();
    expect(screen.getAllByAltText(image.altText)).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'Jerin hotunan labari' })).toBeTruthy();
    expect(screen.getByText('An gyara lokacin da aka ambata a baya.')).toBeTruthy();
    expect(screen.queryByText(/storageKey|sha256|rightsNotes/)).toBeNull();
  });

  it('shows at most three recent articles without displacing the incident-reporting action', () => {
    render(
      <PublicHome
        locale="en"
        recentNews={[1, 2, 3, 4].map((number) => ({
          ...list.items[0]!,
          slug: `article-${number}`,
          title: `Article ${number}`,
        }))}
      />,
    );
    expect(screen.getAllByText(/Article [1-3]/)).toHaveLength(3);
    expect(screen.queryByText('Article 4')).toBeNull();
    expect(screen.getByRole('link', { name: 'Report an incident' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View all news' }).getAttribute('href')).toBe(
      '/en/news',
    );
  });

  it('contains no public mutations, HTML renderer, polling, analytics, or browser storage', () => {
    const source = [
      readFileSync(resolve(process.cwd(), 'src/components/public/public-news-article.tsx'), 'utf8'),
      readFileSync(resolve(process.cwd(), 'src/components/public/public-news-list.tsx'), 'utf8'),
      readFileSync(resolve(process.cwd(), 'src/lib/public-news-api.ts'), 'utf8'),
    ].join('\n');
    expect(source).not.toContain('dangerouslySetInnerHTML');
    expect(source).not.toMatch(
      /localStorage|sessionStorage|setInterval|analytics|POST|PATCH|DELETE/,
    );
  });
});
