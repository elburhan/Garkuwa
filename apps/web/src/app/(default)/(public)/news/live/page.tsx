import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LiveUpdatesFeed } from '@/components/public/live-updates-feed';
import { getMessages } from '@/i18n';
import { webEnvironment } from '@/lib/env';
import { loadPublicNews, parsePublicNewsPage } from '@/lib/public-news-api';

const absolute = (path: string) => new URL(path, webEnvironment.NEXT_PUBLIC_APP_URL).href;
const copy = getMessages('ha').publicNews;
export const metadata: Metadata = {
  title: `${copy.latestLiveUpdates} | ${getMessages('ha').common.siteName}`,
  description: copy.liveUpdatesIntroduction,
  alternates: {
    canonical: absolute('/news/live'),
    languages: { ha: absolute('/news/live'), en: absolute('/en/news/live') },
  },
};
export const revalidate = 60;

export default async function HausaLiveUpdatesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ page?: string | string[] }> }>) {
  const page = parsePublicNewsPage((await searchParams).page);
  if (page === null) notFound();
  const result = await loadPublicNews('ha', { page, pageSize: 20, category: 'live-updates' });
  if (result.kind === 'invalid' || result.kind === 'not-found') notFound();
  if (result.kind !== 'success')
    return (
      <main className="content-width section-spacing">
        <h1>{copy.latestLiveUpdates}</h1>
        <p role="alert">{copy.unavailable}</p>
      </main>
    );
  return (
    <LiveUpdatesFeed
      locale="ha"
      news={result.data}
      initialNow={new Date(result.data.generatedAt).getTime()}
    />
  );
}
