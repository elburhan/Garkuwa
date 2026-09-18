import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicLiveEvent } from '@/components/public/public-live-event';
import { loadPublicLiveEvent } from '@/lib/public-live-api';
import { liveDetailMetadata } from '@/lib/public-live-metadata';

export const revalidate = 15;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return liveDetailMetadata((await params).slug, 'en');
}
export default async function Page({
  params,
}: Readonly<{ params: Promise<{ locale: string; slug: string }> }>) {
  const { locale, slug } = await params;
  if (locale !== 'en') notFound();
  const result = await loadPublicLiveEvent(slug, 'en');
  if (result.kind === 'not-found') notFound();
  if (result.kind !== 'success')
    return (
      <main>
        <p role="alert">Live coverage is unavailable.</p>
      </main>
    );
  return <PublicLiveEvent event={result.data} locale="en" />;
}
