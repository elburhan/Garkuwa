import { getMessages, type Locale } from '@/i18n';
import { webEnvironment } from '@/lib/env';

import { IncidentReportForm } from './incident-report-form';
import { PageHeader } from './page-header';

export function IncidentReportPage({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale).public.incidentReport;

  return (
    <div className="section-spacing">
      <div className="content-width report-page">
        <PageHeader
          eyebrow={messages.eyebrow}
          title={messages.title}
          introduction={messages.introduction}
        />
        <div className="report-notices" aria-label={messages.privacyTitle}>
          <section className="report-notice report-notice-trust">
            <h2>{messages.privacyTitle}</h2>
            <p>{messages.privacyBody}</p>
          </section>
          <section className="report-notice report-notice-warning">
            <h2>{messages.emergencyTitle}</h2>
            <p>{messages.emergencyBody}</p>
          </section>
        </div>
        <IncidentReportForm
          locale={locale}
          messages={messages}
          apiBaseUrl={webEnvironment.NEXT_PUBLIC_API_BASE_URL}
        />
      </div>
    </div>
  );
}
