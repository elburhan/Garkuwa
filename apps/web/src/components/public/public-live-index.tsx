import Link from 'next/link';

import type { PublicLiveEventList } from '@garkuwa/contracts/live';
import { publicNewsMediaUrl } from '@/lib/public-news-api';

/* eslint-disable @next/next/no-img-element -- API-authorized newsroom images use runtime URLs. */

const labels = {
  ha: {
    title: 'Rahotanni kai tsaye',
    intro: 'Sabbin bayanai daga abubuwan da ke faruwa.',
    live: 'KAI TSAYE YANZU',
    recent: 'RAHOTANNIN KAI TSAYE NA BAYA',
    empty: 'Babu rahoto kai tsaye a yanzu.',
    started: 'An fara',
    updated: 'Sabuntawa na ƙarshe',
  },
  en: {
    title: 'Live coverage',
    intro: 'Verified updates from developing events.',
    live: 'LIVE NOW',
    recent: 'RECENT LIVE COVERAGE',
    empty: 'No live coverage is available.',
    started: 'Started',
    updated: 'Last updated',
  },
} as const;

export function PublicLiveIndex({
  data,
  locale,
}: Readonly<{ data: PublicLiveEventList; locale: 'ha' | 'en' }>) {
  const copy = labels[locale];
  const active = data.items.filter((item) => item.status === 'ACTIVE');
  const closed = data.items.filter((item) => item.status === 'CLOSED');
  const render = (items: typeof data.items) => (
    <ul className="public-live-event-list">
      {items.map((item) => (
        <li key={item.slug}>
          {item.featuredMedia ? (
            <>
              <img
                src={publicNewsMediaUrl(item.featuredMedia.url)}
                alt={item.featuredMedia.altText}
                width={item.featuredMedia.width}
                height={item.featuredMedia.height}
                loading="lazy"
              />
            </>
          ) : null}
          <h3>
            <Link href={`${locale === 'en' ? '/en' : ''}/live/${item.slug}`}>{item.title}</Link>
          </h3>
          {item.summary ? <p>{item.summary}</p> : null}
          <p>
            {copy.started}:{' '}
            <time dateTime={item.startedAt}>{new Date(item.startedAt).toLocaleString(locale)}</time>
            {item.latestUpdateAt ? (
              <>
                {' '}
                · {copy.updated}:{' '}
                <time dateTime={item.latestUpdateAt}>
                  {new Date(item.latestUpdateAt).toLocaleString(locale)}
                </time>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
  return (
    <main className="content-width section-spacing" lang={locale}>
      <h1>{copy.title}</h1>
      <p>{copy.intro}</p>
      {data.items.length === 0 ? (
        <p className="empty-state">{copy.empty}</p>
      ) : (
        <>
          {active.length ? (
            <section>
              <h2>{copy.live}</h2>
              {render(active)}
            </section>
          ) : null}
          {closed.length ? (
            <section>
              <h2>{copy.recent}</h2>
              {render(closed)}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
