import { PublicHome } from '@/components/public/public-home';
import { loadPublicNews } from '@/lib/public-news-api';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('en', 'home');
export const revalidate = 60;

export default async function EnglishHomePage() {
  const result = await loadPublicNews('en', { pageSize: 3 });
  return <PublicHome locale="en" recentNews={result.kind === 'success' ? result.data.items : []} />;
}
