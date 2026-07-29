import { PublicHome } from '@/components/public/public-home';
import { loadPublicNews } from '@/lib/public-news-api';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('en', 'home');
export const revalidate = 60;

export default async function EnglishHomePage() {
  const [result, live] = await Promise.all([
    loadPublicNews('en', { pageSize: 8 }),
    loadPublicNews('en', { pageSize: 5, category: 'live-updates' }),
  ]);
  const recent =
    result.kind === 'success'
      ? result.data.items.filter((item) => item.category.slug !== 'live-updates').slice(0, 3)
      : [];
  return (
    <PublicHome
      locale="en"
      recentNews={recent}
      liveUpdates={live.kind === 'success' ? live.data.items : []}
      initialNow={live.kind === 'success' ? new Date(live.data.generatedAt).getTime() : undefined}
    />
  );
}
