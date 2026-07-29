// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomepageLiveUpdates } from '../src/components/public/homepage-live-updates';
import { LiveUpdatesFeed } from '../src/components/public/live-updates-feed';
import {
  formatRelativePublicationTime,
  RelativePublicationTime,
} from '../src/components/public/relative-publication-time';
import type { PublicNewsList } from '../src/lib/public-news-api';

const publishedAt = '2026-07-29T10:00:00.000Z';
const now = new Date('2026-07-29T10:02:00.000Z').getTime();
const news: PublicNewsList = {
  generatedAt: new Date(now).toISOString(),
  items: [
    {
      slug: 'sabuntawa-na-farko',
      title: 'Sabuntawa na farko',
      summary: 'Gajeren bayani mai muhimmancin lokaci.',
      publishedAt,
      hasEnglishTranslation: true,
      category: { slug: 'live-updates', name: 'Sabuntawa na Kai Tsaye' },
    },
  ],
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Live Updates public experience', () => {
  it('renders a semantic Hausa feed with exact and relative time', () => {
    render(<LiveUpdatesFeed locale="ha" news={news} initialNow={now} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Sabbin Sabuntawa na Kai Tsaye' }),
    ).toBeTruthy();
    expect(screen.getByRole('list').querySelectorAll('article')).toHaveLength(1);
    expect(
      screen
        .getByText(/mintuna 2/)
        .closest('time')
        ?.getAttribute('datetime'),
    ).toBe(publishedAt);
  });

  it('omits an empty homepage block and caps populated output at five', () => {
    const { container, rerender } = render(
      <HomepageLiveUpdates locale="en" items={[]} initialNow={now} />,
    );
    expect(container.innerHTML).toBe('');
    rerender(
      <HomepageLiveUpdates
        locale="en"
        initialNow={now}
        items={Array.from({ length: 7 }, (_, index) => ({
          ...news.items[0]!,
          slug: `update-${index}`,
          title: `Update ${index}`,
          category: { slug: 'live-updates', name: 'Live Updates' },
        }))}
      />,
    );
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'See all Live Updates' }).getAttribute('href')).toBe(
      '/en/news/live',
    );
  });

  it('updates locally every minute and clears its interval', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const clear = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(
      <RelativePublicationTime publishedAt={publishedAt} locale="en" initialNow={now} />,
    );
    expect(formatRelativePublicationTime(publishedAt, now, 'en')).toBe('Updated 2 minutes ago');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText(/Updated 3 minutes ago/)).toBeTruthy();
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
