import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';
import type { AdminPrincipal } from '@/lib/admin-auth';
import {
  dashboardPath,
  dashboardRanges,
  type DashboardRange,
  type OperationsDashboard,
} from '@/lib/admin-operations-dashboard-api';

import { AdminLogoutButton } from './admin-logout-button';

function maximumCount(rows: readonly { count: number }[]): number {
  return Math.max(1, ...rows.map((row) => row.count));
}

export function AdminOperationsDashboard({
  locale,
  principal,
  dashboard,
  apiBaseUrl,
}: Readonly<{
  locale: Locale;
  principal: AdminPrincipal;
  dashboard: OperationsDashboard;
  apiBaseUrl: string;
}>) {
  const messages = getMessages(locale).admin;
  const dashboardMessages = messages.dashboard;
  const incidents = messages.incidents;
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
  });
  const dateTimeFormatter = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const trendMaximum = maximumCount(dashboard.submissionTrend);
  const rangeLabel: Record<DashboardRange, string> = {
    '7d': dashboardMessages.last7Days,
    '30d': dashboardMessages.last30Days,
    '90d': dashboardMessages.last90Days,
  };
  const metrics = [
    ['totalIncidents', dashboard.overview.totalIncidents],
    ['newIncidents', dashboard.overview.newIncidents],
    ['underReviewIncidents', dashboard.overview.underReviewIncidents],
    ['openIncidents', dashboard.overview.openIncidents],
    ['unassignedIncidents', dashboard.overview.unassignedIncidents],
    ['closedIncidents', dashboard.overview.closedIncidents],
    ['rejectedIncidents', dashboard.overview.rejectedIncidents],
  ] as const;

  function activityText(activity: OperationsDashboard['recentActivity'][number]): string {
    const actor = activity.actor?.displayName ?? dashboardMessages.systemActor;
    if (activity.type === 'INCIDENT_SUBMITTED') {
      return dashboardMessages.incidentSubmitted.replace(
        '{caseId}',
        activity.incident.internalCaseId,
      );
    }
    if (activity.type === 'STATUS_CHANGED') {
      return dashboardMessages.statusChanged
        .replace('{actor}', actor)
        .replace(
          '{from}',
          activity.summary.fromStatus
            ? incidents.status[activity.summary.fromStatus]
            : dashboardMessages.notAssigned,
        )
        .replace(
          '{to}',
          activity.summary.toStatus
            ? incidents.status[activity.summary.toStatus]
            : dashboardMessages.notAssigned,
        );
    }
    if (activity.type === 'ASSIGNMENT_CHANGED') {
      return dashboardMessages.assignmentChanged
        .replace('{actor}', actor)
        .replace(
          '{from}',
          activity.summary.fromAssigneeDisplayName ?? dashboardMessages.notAssigned,
        )
        .replace('{to}', activity.summary.toAssigneeDisplayName ?? dashboardMessages.notAssigned);
    }
    const decision =
      activity.summary.attachmentDecision === 'AVAILABLE'
        ? dashboardMessages.approvedForAccess
        : dashboardMessages.rejectedAttachments;
    return dashboardMessages.attachmentReviewed
      .replace('{actor}', actor)
      .replace('{decision}', decision);
  }

  return (
    <main className="admin-dashboard content-width section-spacing" lang={locale}>
      <header className="admin-landing-header">
        <div>
          <p className="eyebrow">{dashboardMessages.eyebrow}</p>
          <h1>{dashboardMessages.title}</h1>
          <p>{messages.landing.welcome.replace('{name}', principal.name)}</p>
          <p>{dashboardMessages.readOnly}</p>
        </div>
        <nav aria-label={messages.login.languageLabel} className="admin-language-links">
          <Link
            href={dashboardPath('ha', dashboard.range.key)}
            aria-current={locale === 'ha' ? 'page' : undefined}
          >
            Hausa
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={dashboardPath('en', dashboard.range.key)}
            aria-current={locale === 'en' ? 'page' : undefined}
          >
            English
          </Link>
        </nav>
      </header>

      <div className="admin-dashboard-actions">
        <nav aria-label={dashboardMessages.selectedPeriod}>
          <span>{dashboardMessages.selectedPeriod}: </span>
          {dashboardRanges.map((range) => (
            <Link
              key={range}
              href={dashboardPath(locale, range)}
              aria-current={dashboard.range.key === range ? 'page' : undefined}
            >
              {rangeLabel[range]}
            </Link>
          ))}
        </nav>
        <Link className="button button-primary" href={`/admin/incidents?lang=${locale}`}>
          {dashboardMessages.goToQueue}
        </Link>
        <AdminLogoutButton locale={locale} apiBaseUrl={apiBaseUrl} />
      </div>

      <p className="admin-generated-at">
        {dashboardMessages.generatedAt}:{' '}
        <time dateTime={dashboard.generatedAt}>
          {dateTimeFormatter.format(new Date(dashboard.generatedAt))}
        </time>
      </p>

      <section aria-labelledby="dashboard-overview-title">
        <h2 id="dashboard-overview-title">{dashboardMessages.overview}</h2>
        <div className="admin-metric-grid">
          {metrics.map(([key, count]) => (
            <article className="admin-metric-card" key={key}>
              <h3>{dashboardMessages[key]}</h3>
              <p>{count}</p>
            </article>
          ))}
        </div>
      </section>

      {dashboard.overview.totalIncidents === 0 ? (
        <p className="admin-message-card">{dashboardMessages.noIncidents}</p>
      ) : null}

      <div className="admin-dashboard-grid">
        <section className="admin-detail-card" aria-labelledby="status-distribution-title">
          <h2 id="status-distribution-title">{dashboardMessages.statusDistribution}</h2>
          <table className="admin-summary-table">
            <caption>{dashboardMessages.currentWorkload}</caption>
            <thead>
              <tr>
                <th scope="col">{incidents.queue.status}</th>
                <th scope="col">{dashboardMessages.count}</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.statusDistribution.map((row) => (
                <tr key={row.status}>
                  <th scope="row">{incidents.status[row.status]}</th>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="admin-detail-card" aria-labelledby="severity-distribution-title">
          <h2 id="severity-distribution-title">{dashboardMessages.severityDistribution}</h2>
          <table className="admin-summary-table">
            <caption>{dashboardMessages.currentWorkload}</caption>
            <thead>
              <tr>
                <th scope="col">{incidents.queue.severity}</th>
                <th scope="col">{dashboardMessages.count}</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.severityDistribution.map((row) => (
                <tr key={row.severity}>
                  <th scope="row">{incidents.severity[row.severity]}</th>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="admin-detail-card" aria-labelledby="submission-trend-title">
        <h2 id="submission-trend-title">{dashboardMessages.submissionTrend}</h2>
        <p>{dashboardMessages.utcNotice}</p>
        <div className="admin-trend-bars" aria-hidden="true">
          {dashboard.submissionTrend.map((row) => (
            <span
              key={row.date}
              style={{ height: `${Math.max(0.2, row.count / trendMaximum) * 100}%` }}
              title={`${row.date}: ${row.count}`}
            />
          ))}
        </div>
        <div className="admin-table-scroll">
          <table className="admin-summary-table">
            <caption>{dashboardMessages.dailySubmissions}</caption>
            <thead>
              <tr>
                <th scope="col">{dashboardMessages.date}</th>
                <th scope="col">{dashboardMessages.count}</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.submissionTrend.map((row) => (
                <tr key={row.date}>
                  <th scope="row">
                    <time dateTime={row.date}>
                      {dateFormatter.format(new Date(`${row.date}T00:00:00.000Z`))}
                    </time>
                  </th>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-detail-card" aria-labelledby="assignment-workload-title">
          <h2 id="assignment-workload-title">{dashboardMessages.assignmentWorkload}</h2>
          <p>{dashboardMessages.workloadDisclaimer}</p>
          {dashboard.assignmentWorkload.length === 0 ? (
            <p>{dashboardMessages.noAssignedWorkload}</p>
          ) : (
            <table className="admin-summary-table">
              <caption>{dashboardMessages.activeAssignedIncidents}</caption>
              <thead>
                <tr>
                  <th scope="col">{dashboardMessages.staffMember}</th>
                  <th scope="col">{dashboardMessages.count}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.assignmentWorkload.map((row) => (
                  <tr key={row.staff.id}>
                    <th scope="row">{row.staff.displayName}</th>
                    <td>{row.activeIncidentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-detail-card" aria-labelledby="attachment-workload-title">
          <h2 id="attachment-workload-title">{dashboardMessages.attachmentWorkload}</h2>
          <dl className="admin-dashboard-definition-list">
            <div>
              <dt>{dashboardMessages.awaitingSecurityReview}</dt>
              <dd>{dashboard.attachmentReviewWorkload.quarantined}</dd>
            </div>
            <div>
              <dt>{dashboardMessages.approvedForAccess}</dt>
              <dd>{dashboard.attachmentReviewWorkload.available}</dd>
            </div>
            <div>
              <dt>{dashboardMessages.rejectedAttachments}</dt>
              <dd>{dashboard.attachmentReviewWorkload.rejected}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="admin-detail-card" aria-labelledby="recent-activity-title">
        <h2 id="recent-activity-title">{dashboardMessages.recentActivity}</h2>
        {dashboard.recentActivity.length === 0 ? (
          <p>{dashboardMessages.noActivity}</p>
        ) : (
          <ol className="admin-activity-list">
            {dashboard.recentActivity.map((activity, index) => (
              <li key={`${activity.occurredAt}-${activity.type}-${index}`}>
                <p>{activityText(activity)}</p>
                <p>
                  <Link
                    href={`/admin/incidents/${activity.incident.id}?lang=${locale}`}
                    aria-label={dashboardMessages.openCase.replace(
                      '{caseId}',
                      activity.incident.internalCaseId,
                    )}
                  >
                    {activity.incident.internalCaseId}
                  </Link>
                  {' · '}
                  <time dateTime={activity.occurredAt}>
                    {dateTimeFormatter.format(new Date(activity.occurredAt))}
                  </time>
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
