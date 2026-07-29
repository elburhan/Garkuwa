import { PublicHome } from '@/components/public/public-home';
import { loadPublicNews } from '@/lib/public-news-api';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('ha', 'home');
export const revalidate = 60;

export default async function HausaHomePage() {
  const result = await loadPublicNews('ha', { pageSize: 3 });
  return <PublicHome locale="ha" recentNews={result.kind === 'success' ? result.data.items : []} />;
}
