import { redirect } from 'next/navigation';

import { AdminNewsList } from '@/components/admin/admin-news-list';
import type { Locale } from '@/i18n';
import { getMessages } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { loadNewsArticles, loadNewsCategories } from '@/lib/admin-news-api';

export default async function NewsReviewQueuePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ lang?: string }> }>) {
  const parameters = await searchParams;
  const locale: Locale = parameters.lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (!['SUPER_ADMIN', 'ADMIN', 'MODERATOR'].includes(principal.role)) {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{getMessages(locale).admin.news.management}</h1>
        <p role="alert">{getMessages(locale).admin.news.accessDenied}</p>
      </main>
    );
  }
  const parametersWithView = { ...parameters, view: 'NEEDS_REVIEW' };
  const [news, categories] = await Promise.all([
    loadNewsArticles(parametersWithView),
    loadNewsCategories(),
  ]);
  if (news.kind === 'unauthenticated') redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (news.kind !== 'success' || categories.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{getMessages(locale).admin.news.needsReview}</h1>
        <p role="alert">{getMessages(locale).admin.news.articleUnavailable}</p>
      </main>
    );
  }
  return (
    <AdminNewsList
      locale={locale}
      principal={principal}
      news={news.data}
      parameters={parametersWithView}
      categories={categories.data.items}
    />
  );
}
