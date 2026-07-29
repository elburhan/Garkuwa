// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminNewsDetail } from '../src/components/admin/admin-news-detail';
import { AdminNewsForm } from '../src/components/admin/admin-news-form';
import { AdminNewsList } from '../src/components/admin/admin-news-list';
import type { AdminPrincipal } from '../src/lib/admin-auth';
import type { NewsArticle, NewsArticleList, NewsCategories } from '../src/lib/admin-news-api';

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock('../src/lib/env', () => ({
  webEnvironment: { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api' },
}));

const principal = (role: AdminPrincipal['role'], id = 'author-id'): AdminPrincipal => ({
  id,
  email: 'staff@example.test',
  name: 'Staff',
  role,
});
const article: NewsArticle = {
  id: '52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
  slug: 'sanarwar-tsaro',
  status: 'DRAFT',
  titleHa: 'Sanarwar Tsaro',
  summaryHa: 'Wannan taƙaitaccen bayanin gwaji ne na sashen edita.',
  bodyHa: `Cikakken rubutun gwaji ne. ${'Bayani '.repeat(20)}`,
  titleEn: null,
  summaryEn: null,
  bodyEn: null,
  createdAt: '2026-07-29T10:00:00.000Z',
  updatedAt: '2026-07-29T10:00:00.000Z',
  submittedForReviewAt: null,
  publishedAt: null,
  archivedAt: null,
  author: { id: 'author-id', displayName: 'Marubucin Gwaji' },
  category: { code: 'NEWS', slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
  securityAdvisory: null,
};
const categories: NewsCategories['items'] = [
  {
    code: 'NEWS',
    slug: 'news',
    nameHa: 'Labarai',
    nameEn: 'News',
    descriptionHa: null,
    descriptionEn: null,
    displayOrder: 6,
    isActive: true,
  },
];
const list: NewsArticleList = {
  items: [article],
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  refresh.mockReset();
  push.mockReset();
});

describe('admin news editorial foundation', () => {
  it('renders Hausa by default and English independently with language-preserving links', () => {
    const { rerender } = render(
      <AdminNewsList
        locale="ha"
        principal={principal('EDITOR')}
        news={list}
        parameters={{}}
        categories={categories}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Rubuce-rubucen sashen edita' })).toBeTruthy();
    expect(screen.getAllByText('Daftari').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Ƙirƙiri rubutu' }).getAttribute('href')).toBe(
      '/admin/news/new',
    );
    rerender(
      <AdminNewsList
        locale="en"
        principal={principal('EDITOR')}
        news={list}
        parameters={{ lang: 'en' }}
        categories={categories}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Editorial articles' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create article' }).getAttribute('href')).toContain(
      'lang=en',
    );
  });

  it('keeps create and workflow controls role-aware', () => {
    const { rerender } = render(
      <AdminNewsList
        locale="en"
        principal={principal('MODERATOR')}
        news={list}
        parameters={{}}
        categories={categories}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Create article' })).toBeNull();
    rerender(
      <AdminNewsDetail
        locale="en"
        principal={principal('EDITOR')}
        article={article}
        history={[]}
        categories={categories}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Edit draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeTruthy();

    rerender(
      <AdminNewsDetail
        locale="en"
        principal={principal('EDITOR', 'other-editor')}
        article={article}
        history={[]}
        categories={categories}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Edit draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });

  it('preserves draft input after client or server validation errors', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 400 }));
    render(<AdminNewsForm locale="en" categories={categories} />);
    fireEvent.change(screen.getAllByLabelText('Title')[0]!, {
      target: { value: 'Valid Hausa title' },
    });
    fireEvent.change(screen.getAllByLabelText('Summary')[0]!, {
      target: { value: 'A sufficiently complete Hausa summary for this test.' },
    });
    fireEvent.change(screen.getAllByLabelText('Body')[0]!, {
      target: { value: `A complete Hausa body. ${'Content '.repeat(20)}` },
    });
    fireEvent.change(screen.getAllByLabelText('Title')[1]!, {
      target: { value: 'Partial English title' },
    });
    await user.click(screen.getByRole('button', { name: 'Create article' }));
    expect(screen.getByRole('alert').textContent).toContain('highlighted');
    expect((screen.getAllByLabelText('Title')[1] as HTMLInputElement).value).toBe(
      'Partial English title',
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('renders plain-text history and no public preview, rich text, or browser storage', () => {
    render(
      <AdminNewsDetail
        locale="en"
        principal={principal('MODERATOR')}
        article={{ ...article, status: 'IN_REVIEW' }}
        history={[
          {
            id: 'history-id',
            fromStatus: 'DRAFT',
            toStatus: 'IN_REVIEW',
            reason: null,
            createdAt: '2026-07-29T11:00:00.000Z',
            actor: { id: 'author-id', displayName: 'Marubucin Gwaji' },
          },
        ]}
        categories={categories}
      />,
    );
    expect(screen.getByRole('button', { name: 'Return for correction' })).toBeTruthy();
    expect(screen.queryByText(/public preview/i)).toBeNull();
    const source = [
      readFileSync(resolve(process.cwd(), 'src/lib/admin-news-mutations.ts'), 'utf8'),
      readFileSync(resolve(process.cwd(), 'src/components/admin/admin-news-form.tsx'), 'utf8'),
    ].join('');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('dangerouslySetInnerHTML');
    expect(source).not.toMatch(/markdown|rich-text/i);
  });
});
