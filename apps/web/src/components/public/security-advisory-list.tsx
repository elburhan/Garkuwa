import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';
import { publicSecurityAdvisorySeverities, type PublicNewsList } from '@/lib/public-news-api';

function advisoryPath(locale: Locale, page: number, severity?: string): string {
  const query = new URLSearchParams();
  if (page > 1) query.set('page', String(page));
  if (severity) query.set('severity', severity);
  const suffix = query.toString();
  return `${getPublicPath(locale, 'securityNews')}${suffix ? `?${suffix}` : ''}`;
}

export function SecurityAdvisoryList({
  locale,
  news,
  severity,
}: Readonly<{ locale: Locale; news: PublicNewsList; severity?: string }>) {
  const copy = getMessages(locale).publicNews;
  const dateLocale = locale === 'ha' ? 'ha-NG' : 'en-NG';
  const page = news.pagination.page;

  return (
    <main className="content-width section-spacing public-news-page">
      <header className="page-header content-narrow">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.securityAdvisories}</h1>
        <p>{copy.securityAdvisoriesIntroduction}</p>
      </header>
      <nav className="news-language-links" aria-label={copy.languageLabel}>
        <Link href={advisoryPath('ha', page, severity)} hrefLang="ha" lang="ha">
          {copy.hausaVersion}
        </Link>
        <Link href={advisoryPath('en', page, severity)} hrefLang="en" lang="en">
          {copy.englishVersion}
        </Link>
      </nav>
      <form method="get" className="public-news-filter">
        <label htmlFor="advisory-severity">{copy.filterSeverity}</label>
        <select id="advisory-severity" name="severity" defaultValue={severity ?? ''}>
          <option value="">{copy.allSeverities}</option>
          {publicSecurityAdvisorySeverities.map((value) => (
            <option key={value} value={value}>
              {copy.severityLabels[value]}
            </option>
          ))}
        </select>
        <button className="button button-secondary" type="submit">
          {copy.applySeverityFilter}
        </button>
      </form>
      {news.items.length === 0 ? (
        <p className="empty-state" role="status">
          {copy.noAdvisories}
        </p>
      ) : (
        <div className="public-news-list">
          {news.items.map((article) => (
            <article className="public-news-card advisory-card" key={article.slug}>
              {article.securityAdvisory ? (
                <p
                  className={`advisory-severity severity-${article.securityAdvisory.severity.toLowerCase()}`}
                >
                  {copy.severityLabels[article.securityAdvisory.severity]}
                </p>
              ) : null}
              <p className="publication-date">
                <time dateTime={article.publishedAt}>
                  {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'long' }).format(
                    new Date(article.publishedAt),
                  )}
                </time>
              </p>
              <h2>
                <Link href={`${getPublicPath(locale, 'news')}/${article.slug}`}>
                  {article.title}
                </Link>
              </h2>
              <p>{article.summary}</p>
            </article>
          ))}
        </div>
      )}
      <nav className="pagination" aria-label={copy.paginationLabel}>
        {page > 1 ? (
          <Link href={advisoryPath(locale, page - 1, severity)}>{copy.previousPage}</Link>
        ) : (
          <span aria-disabled="true">{copy.previousPage}</span>
        )}
        <span aria-current="page">{copy.pageNumber.replace('{page}', String(page))}</span>
        {page < news.pagination.totalPages ? (
          <Link href={advisoryPath(locale, page + 1, severity)}>{copy.nextPage}</Link>
        ) : (
          <span aria-disabled="true">{copy.nextPage}</span>
        )}
      </nav>
      <p>
        <Link href={getPublicPath(locale, 'news')}>{copy.backToAllNews}</Link>
      </p>
    </main>
  );
}
