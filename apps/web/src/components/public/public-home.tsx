import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';

import { FeatureStatusCard } from './feature-status-card';

export function PublicHome({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale);
  const home = messages.homepage;
  const supportingLinks = [
    {
      href: getPublicPath(locale, 'faq'),
      title: messages.navigation.faq,
      description: messages.faq.introduction,
    },
    {
      href: getPublicPath(locale, 'help'),
      title: messages.navigation.help,
      description: messages.help.introduction,
    },
    {
      href: getPublicPath(locale, 'about'),
      title: messages.navigation.about,
      description: messages.about.introduction,
    },
    {
      href: getPublicPath(locale, 'contact'),
      title: messages.navigation.contact,
      description: messages.contact.introduction,
    },
  ];

  return (
    <>
      <section className="hero-section section-spacing">
        <div className="content-width hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{home.eyebrow}</p>
            <h1>{home.title}</h1>
            <p className="hero-introduction">{home.introduction}</p>
            <div className="action-row">
              <Link className="button button-primary" href={getPublicPath(locale, 'faq')}>
                {home.primaryAction}
              </Link>
              <Link className="button button-secondary" href={getPublicPath(locale, 'help')}>
                {home.secondaryAction}
              </Link>
            </div>
          </div>
          <aside className="hero-status" aria-label={messages.featureStatus.notActive}>
            <span className="status-badge">{messages.featureStatus.comingSoon}</span>
            <p>{home.pillarsIntroduction}</p>
          </aside>
        </div>
      </section>

      <section className="section-spacing" aria-labelledby="pillars-title">
        <div className="content-width">
          <div className="section-heading content-narrow">
            <h2 id="pillars-title">{home.pillarsTitle}</h2>
            <p>{home.pillarsIntroduction}</p>
          </div>
          <div className="two-column-grid">
            <FeatureStatusCard
              title={home.newsTitle}
              description={home.newsDescription}
              status={messages.featureStatus.comingSoon}
            />
            <FeatureStatusCard
              title={home.reportingTitle}
              description={home.reportingDescription}
              status={messages.featureStatus.comingSoon}
            />
          </div>
        </div>
      </section>

      <section className="section-spacing section-tinted" aria-labelledby="homepage-trust-title">
        <div className="content-width">
          <div className="section-heading content-narrow">
            <h2 id="homepage-trust-title">{home.trustTitle}</h2>
            <p>{home.trustIntroduction}</p>
          </div>
          <ul className="trust-grid">
            {[home.trustAccounts, home.trustContact, home.trustTracking, home.trustSeparation].map(
              (item) => (
                <li key={item}>{item}</li>
              ),
            )}
          </ul>
        </div>
      </section>

      <section className="section-spacing" aria-labelledby="steps-title">
        <div className="content-width">
          <div className="section-heading content-narrow">
            <h2 id="steps-title">{home.stepsTitle}</h2>
          </div>
          <ol className="steps-list">
            {[
              [home.stepOneTitle, home.stepOneDescription],
              [home.stepTwoTitle, home.stepTwoDescription],
              [home.stepThreeTitle, home.stepThreeDescription],
            ].map(([title, description], index) => (
              <li key={title}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-spacing section-tinted" aria-labelledby="supporting-links-title">
        <div className="content-width">
          <div className="section-heading content-narrow">
            <h2 id="supporting-links-title">{home.linksTitle}</h2>
            <p>{home.linksDescription}</p>
          </div>
          <div className="supporting-links-grid">
            {supportingLinks.map((link) => (
              <Link className="supporting-link" href={link.href} key={link.href}>
                <strong>{link.title}</strong>
                <span>{link.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
