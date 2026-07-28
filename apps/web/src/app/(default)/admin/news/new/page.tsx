import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminNewsForm } from '@/components/admin/admin-news-form';
import type { Locale } from '@/i18n';
import { getMessages } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const metadata: Metadata = { title: 'Sabon daftarin labari | Gidauniyar Garkuwa' };
const creatorRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EDITOR']);

export default async function NewNewsArticlePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ lang?: string }> }>) {
  const locale: Locale = (await searchParams).lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  const messages = getMessages(locale).admin.news;
  if (!creatorRoles.has(principal.role)) {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{messages.newDraft}</h1>
        <p role="alert">{messages.accessDenied}</p>
      </main>
    );
  }
  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <Link href={`/admin/news${locale === 'en' ? '?lang=en' : ''}`}>
        {messages.backToArticles}
      </Link>
      <h1>{messages.newDraft}</h1>
      <AdminNewsForm locale={locale} />
    </main>
  );
}
