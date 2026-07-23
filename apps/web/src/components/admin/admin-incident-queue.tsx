import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';
import type { AdminIncidentQueue, AdminIncidentSearchParams } from '@/lib/admin-incidents-api';
import { buildAdminIncidentsPath } from '@/lib/admin-incidents-api';
import type { PublicIncidentCategory } from '@/lib/public-api';

const statuses = ['NEW', 'UNDER_REVIEW', 'ACTIONED', 'CLOSED', 'REJECTED'] as const;
const severities = ['LOW', 'MEDIUM', 'HIGH'] as const;
const languages = ['ha', 'en'] as const;
const sorts = ['newest', 'oldest', 'severity', 'status'] as const;

function value(parameters: AdminIncidentSearchParams, key: string): string {
  const current = parameters[key];
  return Array.isArray(current) ? (current[0] ?? '') : (current ?? '');
}

export function AdminIncidentQueue({
  locale,
  queue,
  parameters,
  categories,
}: Readonly<{
  locale: Locale;
  queue: AdminIncidentQueue;
  parameters: AdminIncidentSearchParams;
  categories: PublicIncidentCategory[];
}>) {
  const messages = getMessages(locale).admin.incidents;
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const pageLabel = messages.queue.page
    .replace('{page}', String(queue.pagination.page))
    .replace('{total}', String(Math.max(queue.pagination.totalPages, 1)));

  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">{messages.queue.eyebrow}</p>
          <h1>{messages.queue.title}</h1>
          <p>{messages.queue.description}</p>
        </div>
        <nav
          aria-label={getMessages(locale).admin.login.languageLabel}
          className="admin-language-links"
        >
          <Link
            href={buildAdminIncidentsPath(parameters, {}, 'ha')}
            aria-current={locale === 'ha' ? 'page' : undefined}
          >
            Hausa
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={buildAdminIncidentsPath(parameters, {}, 'en')}
            aria-current={locale === 'en' ? 'page' : undefined}
          >
            English
          </Link>
        </nav>
      </header>

      <form className="admin-filters" method="get" action="/admin/incidents">
        <h2>{messages.queue.filters}</h2>
        <input type="hidden" name="lang" value={locale} />
        <div className="admin-filter-grid">
          <label>
            {messages.queue.search}
            <input name="search" maxLength={120} defaultValue={value(parameters, 'search')} />
          </label>
          <label>
            {messages.queue.status}
            <select name="status" defaultValue={value(parameters, 'status')}>
              <option value="">{messages.queue.all}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {messages.status[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {messages.queue.severity}
            <select name="severity" defaultValue={value(parameters, 'severity')}>
              <option value="">{messages.queue.all}</option>
              {severities.map((severity) => (
                <option key={severity} value={severity}>
                  {messages.severity[severity]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {messages.queue.category}
            <select name="categoryId" defaultValue={value(parameters, 'categoryId')}>
              <option value="">{messages.queue.allCategories}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {locale === 'ha' ? category.nameHa : category.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label>
            {messages.queue.submissionLanguage}
            <select
              name="submissionLanguage"
              defaultValue={value(parameters, 'submissionLanguage')}
            >
              <option value="">{messages.queue.all}</option>
              {languages.map((language) => (
                <option key={language} value={language}>
                  {messages.language[language]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {messages.queue.state}
            <input name="state" maxLength={100} defaultValue={value(parameters, 'state')} />
          </label>
          <label>
            {messages.queue.lga}
            <input name="lga" maxLength={100} defaultValue={value(parameters, 'lga')} />
          </label>
          <label>
            {messages.queue.dateFrom}
            <input type="date" name="dateFrom" defaultValue={value(parameters, 'dateFrom')} />
          </label>
          <label>
            {messages.queue.dateTo}
            <input type="date" name="dateTo" defaultValue={value(parameters, 'dateTo')} />
          </label>
          <label>
            {messages.queue.sort}
            <select name="sort" defaultValue={value(parameters, 'sort') || 'newest'}>
              {sorts.map((sort) => (
                <option key={sort} value={sort}>
                  {messages.sort[sort]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="action-row">
          <button className="button button-primary" type="submit">
            {messages.queue.applyFilters}
          </button>
          <Link className="button button-secondary" href={`/admin/incidents?lang=${locale}`}>
            {messages.queue.clearFilters}
          </Link>
        </div>
      </form>

      <section aria-labelledby="incident-results-title">
        <h2 id="incident-results-title" className="admin-result-count">
          {messages.queue.resultCount.replace('{count}', String(queue.pagination.totalItems))}
        </h2>
        {queue.items.length === 0 ? (
          <p className="admin-message-card">{messages.queue.noResults}</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-incident-table">
              <thead>
                <tr>
                  <th>{messages.queue.caseId}</th>
                  <th>{messages.queue.category}</th>
                  <th>{messages.queue.status}</th>
                  <th>{messages.queue.severity}</th>
                  <th>{messages.queue.location}</th>
                  <th>{messages.queue.submitted}</th>
                  <th>{messages.queue.assigned}</th>
                </tr>
              </thead>
              <tbody>
                {queue.items.map((incident) => {
                  const detailHref = `/admin/incidents/${incident.id}?lang=${locale}`;
                  const location =
                    [incident.state, incident.lga, incident.locationDescription]
                      .filter(Boolean)
                      .join(' · ') || messages.notProvided;
                  return (
                    <tr key={incident.id}>
                      <td data-label={messages.queue.caseId}>
                        <Link
                          href={detailHref}
                          aria-label={messages.queue.openIncident.replace(
                            '{caseId}',
                            incident.internalCaseId,
                          )}
                        >
                          {incident.internalCaseId}
                        </Link>
                      </td>
                      <td data-label={messages.queue.category}>
                        {locale === 'ha' ? incident.category.nameHa : incident.category.nameEn}
                      </td>
                      <td data-label={messages.queue.status}>
                        <span className="admin-status">{messages.status[incident.status]}</span>
                      </td>
                      <td data-label={messages.queue.severity}>
                        {messages.severity[incident.severity]}
                      </td>
                      <td data-label={messages.queue.location}>{location}</td>
                      <td data-label={messages.queue.submitted}>
                        <time dateTime={incident.submittedAt}>
                          {dateFormatter.format(new Date(incident.submittedAt))}
                        </time>
                      </td>
                      <td data-label={messages.queue.assigned}>
                        {incident.assignedTo?.displayName ?? messages.queue.unassigned}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <nav className="admin-pagination" aria-label={pageLabel}>
        {queue.pagination.page > 1 ? (
          <Link
            className="button button-secondary"
            href={buildAdminIncidentsPath(parameters, { page: queue.pagination.page - 1 }, locale)}
          >
            {messages.queue.previous}
          </Link>
        ) : (
          <span />
        )}
        <span aria-current="page">{pageLabel}</span>
        {queue.pagination.page < queue.pagination.totalPages ? (
          <Link
            className="button button-secondary"
            href={buildAdminIncidentsPath(parameters, { page: queue.pagination.page + 1 }, locale)}
          >
            {messages.queue.next}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
