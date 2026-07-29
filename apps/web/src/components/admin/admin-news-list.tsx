import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';
import type { AdminPrincipal } from '@/lib/admin-auth';
import {
  buildNewsPath,
  newsStatuses,
  securityAdvisorySeverities,
  type AdminNewsSearchParams,
  type NewsArticleList,
  type NewsCategories,
} from '@/lib/admin-news-api';

const creatorRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EDITOR']);

export function AdminNewsList({
  locale,
  principal,
  news,
  parameters,
  categories,
}: Readonly<{
  locale: Locale;
  principal: AdminPrincipal;
  news: NewsArticleList;
  parameters: AdminNewsSearchParams;
  categories: NewsCategories['items'];
}>) {
  const messages = getMessages(locale).admin.news;
  const dates = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
  });
  const languageQuery = locale === 'en' ? '?lang=en' : '';
  const selectedCategory = Array.isArray(parameters.category)
    ? parameters.category[0]
    : parameters.category;
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
        <label htmlFor="news-category-filter">{messages.filterCategory}</label>
        <select
          id="news-category-filter"
          name="category"
          defaultValue={String(parameters.category ?? '')}
        >
          <option value="">{messages.allCategories}</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>
              {locale === 'ha' ? category.nameHa : category.nameEn}
            </option>
          ))}
        </select>
        <label htmlFor="news-severity-filter">{messages.filterSeverity}</label>
        <select
          id="news-severity-filter"
          name="severity"
          defaultValue={String(parameters.severity ?? '')}
          disabled={selectedCategory !== 'SECURITY_ADVISORIES'}
        >
          <option value="">{messages.allSeverities}</option>
          {securityAdvisorySeverities.map((severity) => (
            <option key={severity} value={severity}>
              {messages.severityLabels[severity]}
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
                <th scope="col">{messages.category}</th>
                <th scope="col">{messages.severity}</th>
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
                  <td>{locale === 'ha' ? article.category.nameHa : article.category.nameEn}</td>
                  <td>
                    {article.securityAdvisory
                      ? messages.severityLabels[article.securityAdvisory.severity]
                      : '—'}
                  </td>
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
