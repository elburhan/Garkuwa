import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';
import type { AdminIncidentDetail, EligibleAssignee } from '@/lib/admin-incidents-api';

import { AdminIncidentWorkflowControls } from './admin-incident-workflow-controls';

export function AdminIncidentDetailView({
  locale,
  incident,
  role,
  eligibleAssignees = [],
}: Readonly<{
  locale: Locale;
  incident: AdminIncidentDetail;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'ANALYST';
  eligibleAssignees?: readonly EligibleAssignee[];
}>) {
  const messages = getMessages(locale).admin.incidents;
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const location = [incident.state, incident.lga].filter(Boolean).join(' · ');
  const value = (input: string | null) => input || messages.notProvided;

  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <nav aria-label={messages.detail.back}>
        <Link href={`/admin/incidents?lang=${locale}`}>← {messages.detail.back}</Link>
      </nav>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">{messages.detail.eyebrow}</p>
          <h1>{incident.internalCaseId}</h1>
          <p className="admin-read-only-notice">{messages.detail.workflowScope}</p>
        </div>
        <nav
          aria-label={getMessages(locale).admin.login.languageLabel}
          className="admin-language-links"
        >
          <Link
            href={`/admin/incidents/${incident.id}?lang=ha`}
            aria-current={locale === 'ha' ? 'page' : undefined}
          >
            Hausa
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/admin/incidents/${incident.id}?lang=en`}
            aria-current={locale === 'en' ? 'page' : undefined}
          >
            English
          </Link>
        </nav>
      </header>

      <section className="admin-detail-card" aria-labelledby="incident-description-title">
        <h2 id="incident-description-title">{messages.detail.description}</h2>
        <p className="admin-incident-description">{incident.description}</p>
      </section>

      <section className="admin-detail-card" aria-label={messages.detail.title}>
        <dl className="admin-detail-grid">
          <div>
            <dt>{messages.queue.category}</dt>
            <dd>{locale === 'ha' ? incident.category.nameHa : incident.category.nameEn}</dd>
          </div>
          <div>
            <dt>{messages.queue.status}</dt>
            <dd>{messages.status[incident.status]}</dd>
          </div>
          <div>
            <dt>{messages.queue.severity}</dt>
            <dd>{messages.severity[incident.severity]}</dd>
          </div>
          <div>
            <dt>{messages.queue.submissionLanguage}</dt>
            <dd>{messages.language[incident.submissionLanguage]}</dd>
          </div>
          <div>
            <dt>{messages.detail.incidentDate}</dt>
            <dd>{value(incident.incidentDate?.slice(0, 10) ?? null)}</dd>
          </div>
          <div>
            <dt>{messages.detail.incidentTime}</dt>
            <dd>{value(incident.incidentTime?.slice(11, 16) ?? null)}</dd>
          </div>
          <div>
            <dt>{messages.queue.location}</dt>
            <dd>{value(location || null)}</dd>
          </div>
          <div>
            <dt>{messages.detail.locationDescription}</dt>
            <dd>{value(incident.locationDescription)}</dd>
          </div>
          <div>
            <dt>{messages.detail.coordinates}</dt>
            <dd>
              {incident.latitude && incident.longitude
                ? `${incident.latitude}, ${incident.longitude}`
                : messages.notProvided}
            </dd>
          </div>
          <div>
            <dt>{messages.queue.assigned}</dt>
            <dd>{incident.assignedTo?.displayName ?? messages.queue.unassigned}</dd>
          </div>
          <div>
            <dt>{messages.detail.submittedAt}</dt>
            <dd>
              <time dateTime={incident.submittedAt}>
                {dateFormatter.format(new Date(incident.submittedAt))}
              </time>
            </dd>
          </div>
          <div>
            <dt>{messages.detail.updatedAt}</dt>
            <dd>
              <time dateTime={incident.updatedAt}>
                {dateFormatter.format(new Date(incident.updatedAt))}
              </time>
            </dd>
          </div>
          <div>
            <dt>{messages.detail.closedAt}</dt>
            <dd>
              {incident.closedAt ? (
                <time dateTime={incident.closedAt}>
                  {dateFormatter.format(new Date(incident.closedAt))}
                </time>
              ) : (
                messages.notProvided
              )}
            </dd>
          </div>
        </dl>
      </section>

      <AdminIncidentWorkflowControls
        locale={locale}
        incidentId={incident.id}
        status={incident.status}
        assignedToUserId={incident.assignedTo?.id ?? null}
        updatedAt={incident.updatedAt}
        role={role}
        eligibleAssignees={eligibleAssignees}
      />

      <section className="admin-detail-card" aria-labelledby="status-history-title">
        <h2 id="status-history-title">{messages.detail.statusHistory}</h2>
        {incident.statusHistory.length === 0 ? (
          <p>{messages.detail.noHistory}</p>
        ) : (
          <ol className="admin-status-history">
            {incident.statusHistory.map((history, index) => (
              <li key={`${history.changedAt}-${index}`}>
                <h3>{messages.status[history.toStatus]}</h3>
                <p>
                  <time dateTime={history.changedAt}>
                    {dateFormatter.format(new Date(history.changedAt))}
                  </time>
                </p>
                <p>
                  <strong>{messages.detail.changedBy}:</strong>{' '}
                  {history.changedBy?.displayName ?? messages.detail.system}
                </p>
                {history.comment ? (
                  <p>
                    <strong>{messages.detail.comment}:</strong> {history.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="admin-detail-card" aria-labelledby="assignment-history-title">
        <h2 id="assignment-history-title">{messages.workflow.assignmentHistory}</h2>
        {incident.assignmentHistory.length === 0 ? (
          <p>{messages.workflow.noAssignmentHistory}</p>
        ) : (
          <ol className="admin-status-history">
            {incident.assignmentHistory.map((history, index) => (
              <li key={`${history.changedAt}-${index}`}>
                <p>
                  <strong>{messages.workflow.changedFrom}:</strong>{' '}
                  {history.fromUser?.displayName ?? messages.workflow.noPreviousAssignee}
                </p>
                <p>
                  <strong>{messages.workflow.changedTo}:</strong>{' '}
                  {history.toUser?.displayName ?? messages.workflow.unassigned}
                </p>
                <p>
                  <strong>{messages.workflow.changedBy}:</strong> {history.changedBy.displayName}
                </p>
                <p>
                  <time dateTime={history.changedAt}>
                    {dateFormatter.format(new Date(history.changedAt))}
                  </time>
                </p>
                {history.comment ? (
                  <p>
                    <strong>{messages.detail.comment}:</strong> {history.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
