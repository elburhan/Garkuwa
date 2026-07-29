import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';
import type { PublicNewsList } from '@/lib/public-news-api';

import { RelativePublicationTime } from './relative-publication-time';

function livePath(locale: Locale, page?: number): string {
  const base = getPublicPath(locale, 'liveNews');
  return page && page > 1 ? `${base}?page=${page}` : base;
}

export function LiveUpdatesFeed({
  locale,
  news,
  initialNow,
}: Readonly<{ locale: Locale; news: PublicNewsList; initialNow?: number }>) {
  const copy = getMessages(locale).publicNews;
  return (
    <div className="content-width section-spacing public-news-page">
      <header className="page-header content-narrow">
        <p className="eyebrow live-updates-label">
          <span className="live-status-dot" aria-hidden="true" />
          {copy.liveUpdates}
        </p>
        <h1>{copy.latestLiveUpdates}</h1>
        <p>{copy.liveUpdatesIntroduction}</p>
      </header>
      {news.items.length === 0 ? (
        <p className="empty-state" role="status">
          {copy.noLiveUpdates}
        </p>
      ) : (
        <ol className="live-updates-list">
          {news.items.map((article) => (
            <li key={article.slug}>
              <article>
                <p className="publication-date">
                  <RelativePublicationTime
                    publishedAt={article.publishedAt}
                    locale={locale}
                    initialNow={initialNow}
                  />
                </p>
                <p className="category-label">{article.category.name}</p>
                <h2>
                  <Link href={`${getPublicPath(locale, 'news')}/${article.slug}`}>
                    {article.title}
                  </Link>
                </h2>
                <p>{article.summary}</p>
              </article>
            </li>
          ))}
        </ol>
      )}
      {news.pagination.totalPages > 1 ? (
        <nav className="pagination" aria-label={copy.paginationLabel}>
          {news.pagination.page > 1 ? (
            <Link href={livePath(locale, news.pagination.page - 1)}>{copy.previousPage}</Link>
          ) : (
            <span aria-disabled="true">{copy.previousPage}</span>
          )}
          <span aria-current="page">
            {copy.pageNumber.replace('{page}', String(news.pagination.page))}
          </span>
          {news.pagination.page < news.pagination.totalPages ? (
            <Link href={livePath(locale, news.pagination.page + 1)}>{copy.nextPage}</Link>
          ) : (
            <span aria-disabled="true">{copy.nextPage}</span>
          )}
        </nav>
      ) : null}
      <Link className="text-link" href={getPublicPath(locale, 'news')}>
        {copy.backToNews}
      </Link>
    </div>
  );
}
