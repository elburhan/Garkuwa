import Link from 'next/link';

import type { PublicLiveEventDetail } from '@garkuwa/contracts/live';
import { publicNewsMediaUrl } from '@/lib/public-news-api';
import { PublicLiveTimeline } from './public-live-timeline';

const labels = {
  ha: {
    back: 'Koma jerin rahotannin kai tsaye',
    live: 'KAI TSAYE',
    ended: 'AN KAMMALA RAHOTON KAI TSAYE',
    started: 'An fara',
    updated: 'Sabuntawa na ƙarshe',
    translation: '',
  },
  en: {
    back: 'Back to live coverage',
    live: 'LIVE',
    ended: 'LIVE COVERAGE ENDED',
    started: 'Started',
    updated: 'Last updated',
    translation: 'Hausa coverage may contain newer updates.',
  },
} as const;

export function PublicLiveEvent({
  event,
  locale,
}: Readonly<{ event: PublicLiveEventDetail; locale: 'ha' | 'en' }>) {
  const copy = labels[locale];
  return (
    <main className="content-width section-spacing" lang={locale}>
      <Link href={locale === 'en' ? '/en/live' : '/live'}>{copy.back}</Link>
      <p className="live-status-label">
        {event.status === 'ACTIVE' ? `● ${copy.live}` : copy.ended}
      </p>
      <p>{event.category.name}</p>
      <h1>{event.title}</h1>
      {event.summary ? <p className="public-news-standfirst">{event.summary}</p> : null}
      <p>
        {copy.started}:{' '}
        <time dateTime={event.startedAt}>{new Date(event.startedAt).toLocaleString(locale)}</time>
        {event.latestUpdateAt ? (
          <>
            {' '}
            · {copy.updated}:{' '}
            <time dateTime={event.latestUpdateAt}>
              {new Date(event.latestUpdateAt).toLocaleString(locale)}
            </time>
          </>
        ) : null}
      </p>
      {locale === 'en' ? <p className="trust-notice">{copy.translation}</p> : null}
      {event.featuredMedia ? (
        <figure className="public-news-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicNewsMediaUrl(event.featuredMedia.url)}
            alt={event.featuredMedia.altText}
            width={event.featuredMedia.width}
            height={event.featuredMedia.height}
            fetchPriority="high"
          />
          {event.featuredMedia.caption || event.featuredMedia.credit ? (
            <figcaption>
              {event.featuredMedia.caption}
              {event.featuredMedia.caption && event.featuredMedia.credit ? ' · ' : ''}
              {event.featuredMedia.credit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      <PublicLiveTimeline
        slug={event.slug}
        locale={locale}
        initialUpdates={event.updates}
        initialLatestSequence={event.latestSequence}
        initialHasOlder={event.hasOlder}
        initialCheckedAt={event.updatedAt}
      />
    </main>
  );
}
