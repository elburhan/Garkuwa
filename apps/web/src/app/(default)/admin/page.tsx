import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminOperationsDashboard } from '@/components/admin/admin-operations-dashboard';
import { AdminNewsroomOverview } from '@/components/admin/admin-newsroom-overview';
import type { Locale } from '@/i18n';
import { getMessages } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import {
  loadOperationsDashboard,
  normalizeDashboardRange,
} from '@/lib/admin-operations-dashboard-api';
import { webEnvironment } from '@/lib/env';
import { loadNewsroomDashboard } from '@/lib/admin-news-api';

export const metadata: Metadata = {
  title: 'Sashen gudanarwa | Gidauniyar Garkuwa',
};

export default async function AdminLandingPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ lang?: string; range?: string }> }>) {
  const parameters = await searchParams;
  const locale: Locale = parameters.lang === 'en' ? 'en' : 'ha';
  const range = normalizeDashboardRange(parameters.range);
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  const messages = getMessages(locale).admin.dashboard;
  const newsroomResult = principal.role === 'ANALYST' ? null : await loadNewsroomDashboard();
  if (principal.role === 'EDITOR') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{messages.title}</h1>
        {newsroomResult?.kind === 'success' ? (
          <AdminNewsroomOverview locale={locale} dashboard={newsroomResult.data} />
        ) : (
          <p className="admin-message-card" role="alert">
            {messages.unavailable}
          </p>
        )}
      </main>
    );
  }
  const result = await loadOperationsDashboard(range);
  if (result.kind === 'unauthenticated') {
    redirect(`/admin/login?lang=${locale}&reason=expired`);
  }
  if (result.kind === 'forbidden') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{messages.title}</h1>
        <p className="admin-message-card" role="alert">
          {messages.accessDenied}
        </p>
      </main>
    );
  }
  if (result.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{messages.title}</h1>
        <p className="admin-message-card" role="alert">
          {messages.unavailable}
        </p>
        <a href={`/admin?lang=${locale}&range=${range}`}>{messages.refreshPage}</a>
      </main>
    );
  }
  return (
    <AdminOperationsDashboard
      locale={locale}
      principal={principal}
      dashboard={result.data}
      apiBaseUrl={webEnvironment.NEXT_PUBLIC_API_BASE_URL}
      newsroom={newsroomResult?.kind === 'success' ? newsroomResult.data : undefined}
    />
  );
}
