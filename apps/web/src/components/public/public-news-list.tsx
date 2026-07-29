import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';
import type { PublicNewsList } from '@/lib/public-news-api';

function newsPath(locale: Locale, page?: number): string {
  const base = getPublicPath(locale, 'news');
  return page && page > 1 ? `${base}?page=${page}` : base;
}

export function PublicNewsListPage({
  locale,
  news,
}: Readonly<{ locale: Locale; news: PublicNewsList }>) {
  const messages = getMessages(locale);
  const copy = messages.publicNews;
  const dateLocale = locale === 'ha' ? 'ha-NG' : 'en-NG';
  const currentPage = news.pagination.page;

  return (
    <div className="content-width section-spacing public-news-page">
      <header className="page-header content-narrow">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.introduction}</p>
        <p className="public-information-notice">{copy.notice}</p>
      </header>

      <nav className="news-language-links" aria-label={copy.languageLabel}>
        <Link
          href={newsPath('ha', currentPage)}
          hrefLang="ha"
          lang="ha"
          aria-current={locale === 'ha' ? 'page' : undefined}
        >
          {copy.hausaVersion}
        </Link>
        <Link
          href={newsPath('en', currentPage)}
          hrefLang="en"
          lang="en"
          aria-current={locale === 'en' ? 'page' : undefined}
        >
          {copy.englishVersion}
        </Link>
      </nav>

      {news.items.length === 0 ? (
        <p className="empty-state" role="status">
          {copy.empty}
        </p>
      ) : (
        <div className="public-news-list">
          {news.items.map((article) => {
            const href = `${getPublicPath(locale, 'news')}/${article.slug}`;
            return (
              <article className="public-news-card" key={article.slug}>
                <p className="category-label">{article.category.name}</p>
                <p className="publication-date">
                  {copy.publishedOn}{' '}
                  <time dateTime={article.publishedAt}>
                    {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'long' }).format(
                      new Date(article.publishedAt),
                    )}
                  </time>
                </p>
                <h2>
                  <Link href={href}>{article.title}</Link>
                </h2>
                <p>{article.summary}</p>
                <Link
                  className="text-link"
                  href={href}
                  aria-label={`${copy.readArticle}: ${article.title}`}
                >
                  {copy.readArticle}
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {news.pagination.totalPages > 1 ? (
        <nav className="pagination" aria-label={copy.paginationLabel}>
          {currentPage > 1 ? (
            <Link href={newsPath(locale, currentPage - 1)}>{copy.previousPage}</Link>
          ) : (
            <span aria-disabled="true">{copy.previousPage}</span>
          )}
          <span aria-current="page">{copy.pageNumber.replace('{page}', String(currentPage))}</span>
          {currentPage < news.pagination.totalPages ? (
            <Link href={newsPath(locale, currentPage + 1)}>{copy.nextPage}</Link>
          ) : (
            <span aria-disabled="true">{copy.nextPage}</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
