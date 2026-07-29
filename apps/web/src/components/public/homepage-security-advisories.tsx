import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';
import type { PublicNewsItem } from '@/lib/public-news-api';

export function HomepageSecurityAdvisories({
  locale,
  items,
}: Readonly<{ locale: Locale; items: readonly PublicNewsItem[] }>) {
  if (items.length === 0) return null;
  const copy = getMessages(locale).publicNews;
  return (
    <section
      className="section-spacing advisory-section"
      aria-labelledby="security-advisories-title"
    >
      <div className="content-width">
        <div className="section-heading content-narrow">
          <h2 id="security-advisories-title">{copy.latestSecurityAdvisories}</h2>
          <p>{copy.securityAdvisoriesIntroduction}</p>
        </div>
        <div className="recent-news-grid">
          {items.slice(0, 3).map((article) => (
            <article className="public-news-card advisory-card" key={article.slug}>
              {article.securityAdvisory ? (
                <p
                  className={`advisory-severity severity-${article.securityAdvisory.severity.toLowerCase()}`}
                >
                  {copy.severityLabels[article.securityAdvisory.severity]}
                </p>
              ) : null}
              <h3>
                <Link href={`${getPublicPath(locale, 'news')}/${article.slug}`}>
                  {article.title}
                </Link>
              </h3>
              <p>{article.summary}</p>
            </article>
          ))}
        </div>
        <Link className="button button-secondary" href={getPublicPath(locale, 'securityNews')}>
          {copy.viewAllAdvisories}
        </Link>
      </div>
    </section>
  );
}
