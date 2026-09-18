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
  return liveDetailMetadata((await params).slug, 'ha');
}
export default async function Page({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const result = await loadPublicLiveEvent(slug, 'ha');
  if (result.kind === 'not-found') notFound();
  if (result.kind !== 'success')
    return (
      <main>
        <p role="alert">Ba a samu bayanan ba.</p>
      </main>
    );
  return <PublicLiveEvent event={result.data} locale="ha" />;
}
