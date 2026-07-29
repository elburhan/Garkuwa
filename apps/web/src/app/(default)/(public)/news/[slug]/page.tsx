import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicNewsArticle } from '@/components/public/public-news-article';
import { getMessages } from '@/i18n';
import { loadPublicNewsArticle } from '@/lib/public-news-api';
import { createPublicNewsArticleMetadata } from '@/lib/public-news-metadata';

export const revalidate = 60;

type ArticlePageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const result = await loadPublicNewsArticle((await params).slug, 'ha');
  return result.kind === 'success'
    ? createPublicNewsArticleMetadata('ha', result.data)
    : { title: getMessages('ha').publicNews.title };
}

export default async function HausaNewsArticlePage({ params }: ArticlePageProps) {
  const result = await loadPublicNewsArticle((await params).slug, 'ha');
  if (result.kind === 'not-found' || result.kind === 'invalid') notFound();
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
  return <PublicNewsArticle locale="ha" article={result.data} />;
}
