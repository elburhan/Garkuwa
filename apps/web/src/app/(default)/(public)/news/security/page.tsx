import { notFound } from 'next/navigation';

import { SecurityAdvisoryList } from '@/components/public/security-advisory-list';
import { getMessages } from '@/i18n';
import {
  loadPublicNews,
  parsePublicAdvisorySeverity,
  parsePublicNewsPage,
} from '@/lib/public-news-api';
import { createSecurityAdvisoryListMetadata } from '@/lib/public-news-metadata';

export const metadata = createSecurityAdvisoryListMetadata('ha');
export const revalidate = 60;

export default async function HausaSecurityAdvisoriesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    page?: string | string[];
    severity?: string | string[];
  }>;
}>) {
  const parameters = await searchParams;
  const page = parsePublicNewsPage(parameters.page);
  const severity = parsePublicAdvisorySeverity(parameters.severity);
  if (page === null || severity === null) notFound();
  const result = await loadPublicNews('ha', {
    page,
    category: 'security-advisories',
    severity,
  });
  if (result.kind === 'invalid' || result.kind === 'not-found') notFound();
  if (result.kind !== 'success') {
    return (
      <main className="content-width section-spacing">
        <h1>{getMessages('ha').publicNews.securityAdvisories}</h1>
        <p role="alert" className="empty-state">
          {getMessages('ha').publicNews.unavailable}
        </p>
      </main>
    );
  }
  return <SecurityAdvisoryList locale="ha" news={result.data} severity={severity} />;
}
