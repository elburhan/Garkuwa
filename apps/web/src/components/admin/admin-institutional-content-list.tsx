import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';
import type { InstitutionalPageList } from '@/lib/admin-institutional-content-api';

export function AdminInstitutionalContentList({
  locale,
  pages,
}: Readonly<{ locale: Locale; pages: InstitutionalPageList }>) {
  const copy = getMessages(locale).institutionalContent.admin;
  const dates = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
  });
  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">{copy.managedPages}</p>
          <h1>{copy.title}</h1>
          <p>{copy.fixedPagesNotice}</p>
        </div>
        <Link href={`/admin?lang=${locale}`}>{copy.backToDashboard}</Link>
      </header>
      <div className="admin-table-wrapper">
        <table className="admin-incident-table">
          <caption>{copy.exactlyFivePages}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.page}</th>
              <th scope="col">{copy.pageKey}</th>
              <th scope="col">{copy.publicRoutes}</th>
              <th scope="col">{copy.statusLabel}</th>
              <th scope="col">{copy.versions}</th>
              <th scope="col">{copy.updated}</th>
              <th scope="col">{copy.action}</th>
            </tr>
          </thead>
          <tbody>
            {pages.items.map((page) => (
              <tr key={page.pageKey}>
                <th scope="row">{copy.pageNames[page.pageKey]}</th>
                <td data-label={copy.pageKey}>{page.pageKey}</td>
                <td data-label={copy.publicRoutes}>
                  {page.routes.ha} / {page.routes.en}
                </td>
                <td data-label={copy.statusLabel}>{copy.status[page.workflowStatus]}</td>
                <td data-label={copy.versions}>
                  {copy.draftVersion}: {page.draftVersion ?? '—'}; {copy.publishedVersion}:{' '}
                  {page.publishedVersion ?? '—'}
                </td>
                <td data-label={copy.updated}>
                  <time dateTime={page.updatedAt}>{dates.format(new Date(page.updatedAt))}</time>
                </td>
                <td data-label={copy.action}>
                  <Link href={`/admin/content/${page.pageKey}?lang=${locale}`}>
                    {copy.openPage}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
