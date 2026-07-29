import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';
import type { PublicNewsItem } from '@/lib/public-news-api';

import { RelativePublicationTime } from './relative-publication-time';

export function HomepageLiveUpdates({
  locale,
  items,
  initialNow,
}: Readonly<{ locale: Locale; items: readonly PublicNewsItem[]; initialNow?: number }>) {
  if (items.length === 0) return null;
  const copy = getMessages(locale).publicNews;
  return (
    <section className="section-spacing live-updates-section" aria-labelledby="home-live-title">
      <div className="content-width">
        <div className="section-heading content-narrow">
          <p className="eyebrow live-updates-label">
            <span className="live-status-dot" aria-hidden="true" />
            {copy.liveUpdates}
          </p>
          <h2 id="home-live-title">{copy.latestLiveUpdates}</h2>
        </div>
        <ol className="live-updates-list compact">
          {items.slice(0, 5).map((article) => (
            <li key={article.slug}>
              <article>
                <RelativePublicationTime
                  publishedAt={article.publishedAt}
                  locale={locale}
                  initialNow={initialNow}
                />
                <h3>
                  <Link href={`${getPublicPath(locale, 'news')}/${article.slug}`}>
                    {article.title}
                  </Link>
                </h3>
                <p>{article.summary}</p>
              </article>
            </li>
          ))}
        </ol>
        <Link className="text-link" href={getPublicPath(locale, 'liveNews')}>
          {copy.seeAllLiveUpdates}
        </Link>
      </div>
    </section>
  );
}
