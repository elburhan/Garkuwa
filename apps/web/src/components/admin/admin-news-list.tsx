import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';
import type { AdminPrincipal } from '@/lib/admin-auth';
import {
  buildNewsPath,
  newsStatuses,
  type AdminNewsSearchParams,
  type NewsArticleList,
} from '@/lib/admin-news-api';

const creatorRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EDITOR']);

export function AdminNewsList({
  locale,
  principal,
  news,
  parameters,
}: Readonly<{
  locale: Locale;
  principal: AdminPrincipal;
  news: NewsArticleList;
  parameters: AdminNewsSearchParams;
}>) {
  const messages = getMessages(locale).admin.news;
  const dates = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
  });
  const languageQuery = locale === 'en' ? '?lang=en' : '';
  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <header className="admin-landing-header">
        <div>
          <p className="eyebrow">{messages.management}</p>
          <h1>{messages.articles}</h1>
        </div>
        <nav aria-label={messages.management} className="admin-actions">
          <Link
            href={`/admin${locale === 'en' ? '?lang=en' : ''}`}
            className="button button-secondary"
          >
            {getMessages(locale).admin.dashboard.title}
          </Link>
          {creatorRoles.has(principal.role) ? (
            <Link href={`/admin/news/new${languageQuery}`} className="button">
              {messages.createArticle}
            </Link>
          ) : null}
        </nav>
      </header>

      <form method="get" className="admin-filter-form">
        {locale === 'en' ? <input type="hidden" name="lang" value="en" /> : null}
        <label htmlFor="news-status-filter">{messages.filterStatus}</label>
        <select
          id="news-status-filter"
          name="status"
          defaultValue={String(parameters.status ?? '')}
        >
          <option value="">{messages.allStatuses}</option>
          {newsStatuses.map((status) => (
            <option key={status} value={status}>
              {messages.status[status]}
            </option>
          ))}
        </select>
        <button className="button" type="submit">
          {messages.applyFilter}
        </button>
        <Link href={buildNewsPath({ lang: locale === 'en' ? 'en' : undefined })}>
          {messages.clearFilter}
        </Link>
      </form>

      {news.items.length === 0 ? (
        <p className="admin-message-card">{messages.noArticles}</p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <caption>{messages.articles}</caption>
            <thead>
              <tr>
                <th scope="col">{messages.title}</th>
                <th scope="col">{messages.statusLabel}</th>
                <th scope="col">{messages.author}</th>
                <th scope="col">{messages.lastUpdated}</th>
                <th scope="col">{messages.created}</th>
              </tr>
            </thead>
            <tbody>
              {news.items.map((article) => (
                <tr key={article.id}>
                  <td>
                    <Link href={`/admin/news/${article.id}${languageQuery}`}>
                      {article.titleHa}
                    </Link>
                    {article.titleEn ? <small> · EN</small> : null}
                  </td>
                  <td>{messages.status[article.status]}</td>
                  <td>{article.author.displayName}</td>
                  <td>{dates.format(new Date(article.updatedAt))}</td>
                  <td>{dates.format(new Date(article.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="pagination" aria-label={messages.articles}>
        {news.pagination.page > 1 ? (
          <Link href={buildNewsPath(parameters, { page: news.pagination.page - 1 })}>
            {messages.previousPage}
          </Link>
        ) : (
          <span />
        )}
        <span>
          {news.pagination.page} / {Math.max(1, news.pagination.totalPages)}
        </span>
        {news.pagination.page < news.pagination.totalPages ? (
          <Link href={buildNewsPath(parameters, { page: news.pagination.page + 1 })}>
            {messages.nextPage}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
