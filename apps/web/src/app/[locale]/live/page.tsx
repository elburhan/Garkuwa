import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicLiveIndex } from '@/components/public/public-live-index';
import { loadPublicLiveEvents } from '@/lib/public-live-api';
import { liveIndexMetadata } from '@/lib/public-live-metadata';

export const metadata: Metadata = liveIndexMetadata('en');
export const revalidate = 30;
export default async function Page({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  if ((await params).locale !== 'en') notFound();
  const result = await loadPublicLiveEvents(1, 'en');
  return result.kind === 'success' ? (
    <PublicLiveIndex data={result.data} locale="en" />
  ) : (
    <main>
      <h1>Live coverage</h1>
      <p role="alert">Live coverage is unavailable.</p>
    </main>
  );
}
