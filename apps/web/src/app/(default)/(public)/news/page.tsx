import { notFound } from 'next/navigation';

import { PublicNewsListPage } from '@/components/public/public-news-list';
import { getMessages } from '@/i18n';
import { loadPublicNews, parsePublicNewsPage } from '@/lib/public-news-api';
import { createPublicNewsListMetadata } from '@/lib/public-news-metadata';

export const metadata = createPublicNewsListMetadata('ha');
export const revalidate = 60;

export default async function HausaNewsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ page?: string | string[] }> }>) {
  const page = parsePublicNewsPage((await searchParams).page);
  if (page === null) notFound();
  const result = await loadPublicNews('ha', { page });
  if (result.kind === 'invalid' || result.kind === 'not-found') notFound();
  if (result.kind !== 'success') {
    return (
      <div className="content-width section-spacing">
        <h1>{getMessages('ha').publicNews.title}</h1>
        <p role="alert" className="empty-state">
          {getMessages('ha').publicNews.unavailable}
        </p>
      </div>
    );
  }
  return <PublicNewsListPage locale="ha" news={result.data} />;
}
