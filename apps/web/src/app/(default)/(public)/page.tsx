import { PublicHome } from '@/components/public/public-home';
import { loadPublicNews } from '@/lib/public-news-api';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('ha', 'home');
export const revalidate = 60;

export default async function HausaHomePage() {
  const [result, live, advisories] = await Promise.all([
    loadPublicNews('ha', { pageSize: 8 }),
    loadPublicNews('ha', { pageSize: 5, category: 'live-updates' }),
    loadPublicNews('ha', { pageSize: 3, category: 'security-advisories' }),
  ]);
  const recent =
    result.kind === 'success'
      ? result.data.items
          .filter(
            (item) =>
              item.category.slug !== 'live-updates' && item.category.slug !== 'security-advisories',
          )
          .slice(0, 3)
      : [];
  return (
    <PublicHome
      locale="ha"
      recentNews={recent}
      liveUpdates={live.kind === 'success' ? live.data.items : []}
      securityAdvisories={advisories.kind === 'success' ? advisories.data.items : []}
      initialNow={live.kind === 'success' ? new Date(live.data.generatedAt).getTime() : undefined}
    />
  );
}
