import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';
import type { PublicNewsDetail } from '@/lib/public-news-api';

export function PublicNewsArticle({
  article,
  locale,
}: Readonly<{ article: PublicNewsDetail; locale: Locale }>) {
  const copy = getMessages(locale).publicNews;
  const dateLocale = locale === 'ha' ? 'ha-NG' : 'en-NG';
  const haHref = `/news/${article.slug}`;
  const enHref = `/en/news/${article.slug}`;
  const paragraphs = article.body.split(/\r?\n\s*\r?\n/);

  return (
    <article className="content-width section-spacing public-news-article">
      <header className="content-narrow">
        <p className="eyebrow">{copy.eyebrow}</p>
        <p className="category-label">
          {copy.categoryLabel}: {article.category.name}
        </p>
        <h1>{article.title}</h1>
        <p className="publication-date">
          {copy.publishedOn}{' '}
          <time dateTime={article.publishedAt}>
            {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'long' }).format(
              new Date(article.publishedAt),
            )}
          </time>
        </p>
        <p className="article-summary">{article.summary}</p>
      </header>

      <nav className="news-language-links" aria-label={copy.languageLabel}>
        {locale === 'ha' ? (
          <span aria-current="page" lang="ha">
            {copy.hausaVersion}
          </span>
        ) : (
          <Link href={haHref} hrefLang="ha" lang="ha">
            {copy.hausaVersion}
          </Link>
        )}
        {locale === 'en' ? (
          <span aria-current="page" lang="en">
            {copy.englishVersion}
          </span>
        ) : article.hasEnglishTranslation ? (
          <Link href={enHref} hrefLang="en" lang="en">
            {copy.englishVersion}
          </Link>
        ) : (
          <span>{copy.englishUnavailable}</span>
        )}
      </nav>

      <div className="article-body content-narrow">
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
        ))}
      </div>

      {article.securityAdvisory ? (
        <aside className="content-narrow advisory-panel" aria-labelledby="public-advisory-title">
          <p
            className={`advisory-severity severity-${article.securityAdvisory.severity.toLowerCase()}`}
          >
            {copy.severityLabels[article.securityAdvisory.severity]}
          </p>
          <h2 id="public-advisory-title">{copy.securityAdvisories}</h2>
          <h3>{copy.affectedArea}</h3>
          <div className="plain-text-content">{article.securityAdvisory.affectedArea}</div>
          <h3>{copy.recommendedActions}</h3>
          <div className="plain-text-content">{article.securityAdvisory.recommendedActions}</div>
          {article.securityAdvisory.references.length > 0 ? (
            <>
              <h3>{copy.externalReferences}</h3>
              <p className="external-link-notice">{copy.externalLinkNotice}</p>
              <ul>
                {article.securityAdvisory.references.map((reference) => (
                  <li key={reference.url}>
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                    >
                      {reference.label}
                      <span className="visually-hidden"> ({copy.externalLinkNotice})</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>
      ) : null}

      <p>
        <Link className="text-link" href={getPublicPath(locale, 'news')}>
          {copy.backToNews}
        </Link>
      </p>
    </article>
  );
}
