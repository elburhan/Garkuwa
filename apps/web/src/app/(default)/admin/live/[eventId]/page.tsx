import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminLiveDetail } from '@/components/admin/admin-live-detail';
import { getMessages, type Locale } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { loadAdminLiveEvent } from '@/lib/admin-live-server-api';
import { loadAdminMedia } from '@/lib/admin-media-server-api';

export const metadata: Metadata = { title: 'Rufe rahoto kai tsaye | Gidauniyar Garkuwa' };
const posterRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'EDITOR']);
const publisherRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'MODERATOR']);
const metadataEditorRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EDITOR']);

export default async function AdminLiveEventPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ lang?: string }>;
}>) {
  const locale: Locale = (await searchParams).lang === 'en' ? 'en' : 'ha';
  const { eventId } = await params;
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
  const [result, media] = await Promise.all([
    loadAdminLiveEvent(eventId),
    loadAdminMedia({ status: 'ACTIVE' }),
  ]);
  if (result.kind === 'unauthenticated') redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (result.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{messages.title}</h1>
        <p role="alert">{messages.failed}</p>
      </main>
    );
  }
  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <Link href={`/admin/live?lang=${locale}`}>{messages.backToEvents}</Link>
      <AdminLiveDetail
        locale={locale}
        detail={result.data}
        canPostUpdates={posterRoles.has(principal.role)}
        canPublish={publisherRoles.has(principal.role)}
        canEditMetadata={metadataEditorRoles.has(principal.role)}
        media={media.kind === 'success' ? media.data.items : []}
      />
    </main>
  );
}
