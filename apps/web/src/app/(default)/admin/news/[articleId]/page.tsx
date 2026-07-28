import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { AdminNewsDetail } from '@/components/admin/admin-news-detail';
import type { Locale } from '@/i18n';
import { getMessages } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { loadNewsArticle, loadNewsHistory } from '@/lib/admin-news-api';

export const metadata: Metadata = { title: 'Rubutun edita | Gidauniyar Garkuwa' };
const viewerRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'MODERATOR']);

export default async function NewsArticleDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ articleId: string }>;
  searchParams: Promise<{ lang?: string }>;
}>) {
  const [{ articleId }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = query.lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (!viewerRoles.has(principal.role)) {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{getMessages(locale).admin.news.management}</h1>
        <p role="alert">{getMessages(locale).admin.news.accessDenied}</p>
      </main>
    );
  }
  const [articleResult, historyResult] = await Promise.all([
    loadNewsArticle(articleId),
    loadNewsHistory(articleId),
  ]);
  if (articleResult.kind === 'unauthenticated')
    redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (articleResult.kind === 'not-found') notFound();
  if (articleResult.kind !== 'success' || historyResult.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{getMessages(locale).admin.news.articles}</h1>
        <p role="alert">{getMessages(locale).admin.news.articleUnavailable}</p>
      </main>
    );
  }
  return (
    <AdminNewsDetail
      locale={locale}
      principal={principal}
      article={articleResult.data.article}
      history={historyResult.data.items}
    />
  );
}
