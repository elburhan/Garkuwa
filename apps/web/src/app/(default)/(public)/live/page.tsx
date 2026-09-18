import type { Metadata } from 'next';
import { PublicLiveIndex } from '@/components/public/public-live-index';
import { loadPublicLiveEvents } from '@/lib/public-live-api';
import { liveIndexMetadata } from '@/lib/public-live-metadata';

export const metadata: Metadata = liveIndexMetadata('ha');
export const revalidate = 30;

export default async function HausaLiveCoveragePage() {
  const result = await loadPublicLiveEvents(1, 'ha');
  return result.kind === 'success' ? (
    <PublicLiveIndex data={result.data} locale="ha" />
  ) : (
    <main className="content-width section-spacing">
      <h1>Rahotanni kai tsaye</h1>
      <p role="alert">Ba a samu bayanan ba.</p>
    </main>
  );
}
