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

      <p>
        <Link className="text-link" href={getPublicPath(locale, 'news')}>
          {copy.backToNews}
        </Link>
      </p>
    </article>
  );
}
