import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminLiveList } from '@/components/admin/admin-live-list';
import { getMessages, type Locale } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { loadAdminLiveEvents } from '@/lib/admin-live-server-api';
import { loadNewsCategories } from '@/lib/admin-news-api';

export const metadata: Metadata = { title: 'Rufe rahoto kai tsaye | Gidauniyar Garkuwa' };
const creatorRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EDITOR']);

export default async function AdminLivePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ lang?: string; page?: string; status?: string }> }>) {
  const parameters = await searchParams;
  const locale: Locale = parameters.lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  const messages = getMessages(locale).admin.live;
  if (principal.role === 'ANALYST') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{messages.title}</h1>
        <p role="alert">{messages.accessDenied}</p>
      </main>
    );
  }
  const [events, categories] = await Promise.all([
    loadAdminLiveEvents(parameters),
    loadNewsCategories(),
  ]);
  if (events.kind === 'unauthenticated') redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (events.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{messages.title}</h1>
        <p role="alert">{messages.failed}</p>
      </main>
    );
  }
  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <nav>
        <Link href={`/admin?lang=${locale}`}>{getMessages(locale).admin.dashboard.title}</Link>
      </nav>
      <h1>{messages.title}</h1>
      <p>{messages.description}</p>
      <AdminLiveList
        locale={locale}
        events={events.data}
        categories={categories.kind === 'success' ? categories.data.items : []}
        canCreate={creatorRoles.has(principal.role)}
      />
    </main>
  );
}
