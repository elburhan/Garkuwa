import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages, getPublicPath, type Locale } from '@/i18n';
import {
  loadPublicInstitutionalPage,
  type InstitutionalPageKey,
} from '@/lib/public-institutional-content-api';

import { PageHeader } from './page-header';

function paragraphs(body: string) {
  return body.split(/\n{2,}/).map((paragraph) => <p key={paragraph}>{paragraph}</p>);
}

export async function InstitutionalPublicPage({
  locale,
  pageKey,
}: Readonly<{ locale: Locale; pageKey: InstitutionalPageKey }>) {
  const labels = getMessages(locale).institutionalContent.public;
  const result = await loadPublicInstitutionalPage(pageKey, locale);
  if (result.kind === 'not-found') notFound();
  if (result.kind === 'unavailable') {
    return (
      <div className="content-width page-content section-spacing">
        <h1>{labels.unavailableTitle}</h1>
        <p role="alert" className="empty-state">
          {labels.unavailable}
        </p>
      </div>
    );
  }
  const page = result.data;
  const isFaq = pageKey === 'FAQ';
  return (
    <div className="content-width page-content section-spacing">
      <PageHeader
        eyebrow={labels.eyebrow}
        title={page.title}
        introduction={page.summary ?? undefined}
      />
      <div className={isFaq ? 'faq-list' : 'information-grid'}>
        {page.sections.map((section) =>
          isFaq ? (
            <details className="faq-item" id={section.sectionKey} key={section.sectionKey}>
              <summary>{section.heading}</summary>
              {paragraphs(section.body)}
            </details>
          ) : (
            <section className="information-card" id={section.sectionKey} key={section.sectionKey}>
              <h2>{section.heading}</h2>
              {paragraphs(section.body)}
            </section>
          ),
        )}
      </div>
      {pageKey === 'CONTACT' || pageKey === 'SAFETY_GUIDANCE' ? (
        <p className="public-information-notice">
          {labels.confidentialReports}{' '}
          <Link href={getPublicPath(locale, 'reportIncident')}>{labels.reportIncident}</Link>
        </p>
      ) : null}
      {pageKey === 'SAFETY_GUIDANCE' ? (
        <p className="warning-panel">{labels.safetyDisclaimer}</p>
      ) : null}
    </div>
  );
}

export function FaqPage({ locale }: Readonly<{ locale: Locale }>) {
  return <InstitutionalPublicPage locale={locale} pageKey="FAQ" />;
}

export function HelpPage({ locale }: Readonly<{ locale: Locale }>) {
  return <InstitutionalPublicPage locale={locale} pageKey="HELP" />;
}

export function AboutPage({ locale }: Readonly<{ locale: Locale }>) {
  return <InstitutionalPublicPage locale={locale} pageKey="ABOUT" />;
}

export function ContactPage({ locale }: Readonly<{ locale: Locale }>) {
  return <InstitutionalPublicPage locale={locale} pageKey="CONTACT" />;
}

export function SafetyPage({ locale }: Readonly<{ locale: Locale }>) {
  return <InstitutionalPublicPage locale={locale} pageKey="SAFETY_GUIDANCE" />;
}
