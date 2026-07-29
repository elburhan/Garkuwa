import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicNewsArticle } from '@/components/public/public-news-article';
import { getMessages } from '@/i18n';
import { loadPublicNewsArticle } from '@/lib/public-news-api';
import { createPublicNewsArticleMetadata } from '@/lib/public-news-metadata';

export const revalidate = 60;

type ArticlePageProps = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== 'en') return {};
  const result = await loadPublicNewsArticle(slug, 'en');
  return result.kind === 'success'
    ? createPublicNewsArticleMetadata('en', result.data)
    : { title: getMessages('en').publicNews.title };
}

export default async function EnglishNewsArticlePage({ params }: ArticlePageProps) {
  const { locale, slug } = await params;
  if (locale !== 'en') notFound();
  const result = await loadPublicNewsArticle(slug, 'en');
  if (result.kind === 'not-found' || result.kind === 'invalid') notFound();
  if (result.kind !== 'success') {
    return (
      <div className="content-width section-spacing">
        <h1>{getMessages('en').publicNews.title}</h1>
        <p role="alert" className="empty-state">
          {getMessages('en').publicNews.unavailable}
        </p>
      </div>
    );
  }
  return <PublicNewsArticle locale="en" article={result.data} />;
}
