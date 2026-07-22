import { getMessages, type Locale } from '@/i18n';

import { PageHeader } from './page-header';

export function FaqPage({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale).faq;
  return (
    <div className="content-width page-content section-spacing">
      <PageHeader
        eyebrow={messages.eyebrow}
        title={messages.title}
        introduction={messages.introduction}
      />
      <div className="faq-list">
        {messages.items.map((item) => (
          <section className="faq-item" key={item.question}>
            <h2>{item.question}</h2>
            <p>{item.answer}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

export function HelpPage({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale).help;
  return (
    <div className="content-width page-content section-spacing">
      <PageHeader
        eyebrow={messages.eyebrow}
        title={messages.title}
        introduction={messages.introduction}
      />
      <p className="warning-panel">{messages.reportingInactive}</p>
      <InformationSections sections={messages.sections} />
    </div>
  );
}

export function AboutPage({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale).about;
  return (
    <div className="content-width page-content section-spacing">
      <PageHeader
        eyebrow={messages.eyebrow}
        title={messages.title}
        introduction={messages.introduction}
      />
      <InformationSections sections={messages.sections} />
    </div>
  );
}

function InformationSections({
  sections,
}: Readonly<{ sections: readonly { title: string; body: string }[] }>) {
  return (
    <div className="information-grid">
      {sections.map((section) => (
        <section className="information-card" key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </div>
  );
}

export function ContactPage({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale).contact;
  return (
    <div className="content-width page-content section-spacing">
      <PageHeader
        eyebrow={messages.eyebrow}
        title={messages.title}
        introduction={messages.introduction}
      />
      <div className="contact-grid">
        <dl className="contact-details">
          <div>
            <dt>{messages.emailLabel}</dt>
            <dd>{messages.emailPlaceholder}</dd>
          </div>
          <div>
            <dt>{messages.telephoneLabel}</dt>
            <dd>{messages.telephonePlaceholder}</dd>
          </div>
          <div>
            <dt>{messages.addressLabel}</dt>
            <dd>{messages.addressPlaceholder}</dd>
          </div>
        </dl>
        <aside className="warning-panel" aria-labelledby="contact-warning-title">
          <h2 id="contact-warning-title">{messages.sensitiveWarningTitle}</h2>
          <p>{messages.sensitiveWarning}</p>
          <p>{messages.noForm}</p>
        </aside>
      </div>
    </div>
  );
}
