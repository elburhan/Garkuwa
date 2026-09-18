import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';
import { publicNewsMediaUrl, type PublicNewsDetail } from '@/lib/public-news-api';
import { RichArticleBody } from './rich-article-body';

export function PublicNewsArticle({
  article,
  locale,
}: Readonly<{ article: PublicNewsDetail; locale: Locale }>) {
  const copy = getMessages(locale).publicNews;
  const dateLocale = locale === 'ha' ? 'ha-NG' : 'en-NG';
  const haHref = `/news/${article.slug}`;
  const enHref = `/en/news/${article.slug}`;
  const media = [article.featuredMedia, ...article.gallery.map((item) => item.media)]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ ...item, url: publicNewsMediaUrl(item.url) }));

  return (
    <article className="content-width section-spacing public-news-article">
      <header className="content-narrow">
        <p className="eyebrow">{copy.eyebrow}</p>
        <p className="category-label">
          {copy.categoryLabel}: {article.category.name}
        </p>
        <h1>{article.title}</h1>
        {article.isBreaking ? <p className="eyebrow">{copy.breakingLabel}</p> : null}
        <p className="publication-date">
          {copy.publishedOn}{' '}
          <time dateTime={article.publishedAt}>
            {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'long' }).format(
              new Date(article.publishedAt),
            )}
          </time>
        </p>
        {article.updatedAt !== article.publishedAt ? (
          <p className="publication-date">
            {copy.updatedOn}{' '}
            <time dateTime={article.updatedAt}>
              {new Intl.DateTimeFormat(dateLocale, {
                dateStyle: 'long',
                timeStyle: 'short',
              }).format(new Date(article.updatedAt))}
            </time>
          </p>
        ) : null}
        <p className="article-summary">{article.summary}</p>
        {article.contributors && article.contributors.length > 0 ? (
          <ul className="article-bylines" aria-label={copy.byline}>
            {article.contributors.map((contributor) => (
              <li key={`${contributor.slug}-${contributor.contributorRole}`}>
                {contributor.contributorRole === 'AUTHOR'
                  ? `${copy.by}: ${contributor.displayName}`
                  : `${copy.reportingBy}: ${contributor.displayName}`}
              </li>
            ))}
          </ul>
        ) : null}
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

      {article.featuredMedia ? (
        <figure className="public-news-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicNewsMediaUrl(article.featuredMedia.url)}
            alt={article.featuredMedia.altText}
            width={article.featuredMedia.width}
            height={article.featuredMedia.height}
            fetchPriority="high"
          />
          {article.featuredMedia.caption || article.featuredMedia.credit ? (
            <figcaption>
              {article.featuredMedia.caption}
              {article.featuredMedia.caption && article.featuredMedia.credit ? ' · ' : ''}
              {article.featuredMedia.credit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="article-body content-narrow">
        <RichArticleBody blocks={article.bodyBlocks} fallback={article.body} media={media} />
      </div>

      {article.gallery.length > 0 ? (
        <section aria-label={copy.galleryLabel} className="public-news-gallery">
          {article.gallery.map(({ media: item }) => (
            <figure key={item.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicNewsMediaUrl(item.url)}
                alt={item.altText}
                width={item.width}
                height={item.height}
                loading="lazy"
              />
              {item.caption || item.credit ? (
                <figcaption>
                  {item.caption}
                  {item.caption && item.credit ? ' · ' : ''}
                  {item.credit}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </section>
      ) : null}

      {article.corrections.map((correction) => (
        <aside key={correction.id} className="admin-read-only-notice">
          <strong>
            {copy.correctionLabel} —{' '}
            <time dateTime={correction.createdAt}>
              {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(
                new Date(correction.createdAt),
              )}
            </time>
          </strong>
          <p>{correction.note}</p>
        </aside>
      ))}

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
