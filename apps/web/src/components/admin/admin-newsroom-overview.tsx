import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';
import type { NewsroomDashboard } from '@/lib/admin-news-api';

export function AdminNewsroomOverview({
  locale,
  dashboard,
}: Readonly<{ locale: Locale; dashboard: NewsroomDashboard }>) {
  const messages = getMessages(locale).admin.news;
  const cards = [
    ['MY_DRAFTS', messages.myDrafts, dashboard.myDrafts],
    ['NEEDS_REVIEW', messages.waitingForEditor, dashboard.waitingForReview],
    ['CHANGES_REQUESTED', messages.changesRequested, dashboard.changesRequested],
    ['PUBLISHED_TODAY', messages.publishedToday, dashboard.publishedToday],
  ] as const;
  return (
    <section aria-labelledby="newsroom-overview-title">
      <h2 id="newsroom-overview-title">{messages.newsroomHome}</h2>
      <div className="admin-metric-grid">
        {cards.map(([view, label, count]) => (
          <Link
            key={view}
            className="admin-metric-card"
            href={`/admin/news?view=${view}${locale === 'en' ? '&lang=en' : ''}`}
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </Link>
        ))}
      </div>
      <p className="admin-actions">
        <Link className="button" href={`/admin/news/new${locale === 'en' ? '?lang=en' : ''}`}>
          {messages.createArticle}
        </Link>
        <Link
          className="button button-secondary"
          href={`/admin/media${locale === 'en' ? '?lang=en' : ''}`}
        >
          {getMessages(locale).admin.media.title}
        </Link>
      </p>
    </section>
  );
}
