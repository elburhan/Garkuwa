import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';
import type { PublicNewsItem } from '@/lib/public-news-api';

export function RecentPublicNews({
  items,
  locale,
}: Readonly<{ items: readonly PublicNewsItem[]; locale: Locale }>) {
  if (items.length === 0) return null;
  const copy = getMessages(locale).publicNews;
  const dateLocale = locale === 'ha' ? 'ha-NG' : 'en-NG';

  return (
    <section className="section-spacing section-tinted" aria-labelledby="recent-news-title">
      <div className="content-width">
        <div className="section-heading content-narrow">
          <h2 id="recent-news-title">{copy.recentTitle}</h2>
          <p>{copy.recentIntroduction}</p>
        </div>
        <div className="recent-news-grid">
          {items.slice(0, 3).map((article) => (
            <article className="public-news-card" key={article.slug}>
              <p className="category-label">{article.category.name}</p>
              <p className="publication-date">
                <time dateTime={article.publishedAt}>
                  {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'long' }).format(
                    new Date(article.publishedAt),
                  )}
                </time>
              </p>
              <h3>
                <Link href={`${getPublicPath(locale, 'news')}/${article.slug}`}>
                  {article.title}
                </Link>
              </h3>
              <p>{article.summary}</p>
            </article>
          ))}
        </div>
        <p>
          <Link className="button button-secondary" href={getPublicPath(locale, 'news')}>
            {copy.viewAll}
          </Link>
        </p>
      </div>
    </section>
  );
}
