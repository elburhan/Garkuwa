import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';
import type { AdminPrincipal } from '@/lib/admin-auth';
import type { NewsArticle, NewsCategories, NewsHistory } from '@/lib/admin-news-api';

import { AdminNewsForm } from './admin-news-form';
import { AdminNewsWorkflow } from './admin-news-workflow';

export function AdminNewsDetail({
  locale,
  principal,
  article,
  history,
  categories,
}: Readonly<{
  locale: Locale;
  principal: AdminPrincipal;
  article: NewsArticle;
  history: NewsHistory['items'];
  categories: NewsCategories['items'];
}>) {
  const messages = getMessages(locale).admin.news;
  const dates = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const canEdit =
    article.status === 'DRAFT' &&
    (principal.role === 'SUPER_ADMIN' ||
      principal.role === 'ADMIN' ||
      (principal.role === 'EDITOR' && principal.id === article.author.id));
  const lang = locale === 'en' ? '?lang=en' : '';
  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <nav aria-label={messages.management}>
        <Link href={`/admin/news${lang}`}>{messages.backToArticles}</Link>
      </nav>
      <header className="admin-landing-header">
        <div>
          <dt>{messages.category}</dt>
          <dd>{locale === 'ha' ? article.category.nameHa : article.category.nameEn}</dd>
        </div>
        <div>
          <p className="eyebrow">{messages.status[article.status]}</p>
          <h1>{article.titleHa}</h1>
        </div>
      </header>
      <dl className="admin-detail-grid">
        <div>
          <dt>{messages.slug}</dt>
          <dd>{article.slug}</dd>
        </div>
        <div>
          <dt>{messages.author}</dt>
          <dd>{article.author.displayName}</dd>
        </div>
        <div>
          <dt>{messages.created}</dt>
          <dd>{dates.format(new Date(article.createdAt))}</dd>
        </div>
        <div>
          <dt>{messages.lastUpdated}</dt>
          <dd>{dates.format(new Date(article.updatedAt))}</dd>
        </div>
      </dl>
      {canEdit ? (
        <section aria-labelledby="edit-news-title">
          <h2 id="edit-news-title">{messages.editDraft}</h2>
          <AdminNewsForm locale={locale} article={article} categories={categories} />
        </section>
      ) : (
        <>
          <section className="admin-detail-card" aria-labelledby="hausa-news-title">
            <h2 id="hausa-news-title">{messages.hausaContent}</h2>
            <h3>{article.titleHa}</h3>
            <p>{article.summaryHa}</p>
            <div className="plain-text-content">{article.bodyHa}</div>
          </section>
          {article.titleEn && article.summaryEn && article.bodyEn ? (
            <section className="admin-detail-card" lang="en" aria-labelledby="english-news-title">
              <h2 id="english-news-title">{messages.englishTranslation}</h2>
              <h3>{article.titleEn}</h3>
              <p>{article.summaryEn}</p>
              <div className="plain-text-content">{article.bodyEn}</div>
            </section>
          ) : null}
          {article.securityAdvisory ? (
            <section className="admin-detail-card advisory-panel" aria-labelledby="advisory-title">
              <p
                className={`advisory-severity severity-${article.securityAdvisory.severity.toLowerCase()}`}
              >
                {messages.severityLabels[article.securityAdvisory.severity]}
              </p>
              <h2 id="advisory-title">{messages.securityAdvisoryDetails}</h2>
              <h3>{messages.affectedAreaHa}</h3>
              <div className="plain-text-content">{article.securityAdvisory.affectedAreaHa}</div>
              <h3>{messages.recommendedActionsHa}</h3>
              <div className="plain-text-content">
                {article.securityAdvisory.recommendedActionsHa}
              </div>
              {article.securityAdvisory.affectedAreaEn &&
              article.securityAdvisory.recommendedActionsEn ? (
                <div lang="en">
                  <h3>{messages.affectedAreaEn}</h3>
                  <div className="plain-text-content">
                    {article.securityAdvisory.affectedAreaEn}
                  </div>
                  <h3>{messages.recommendedActionsEn}</h3>
                  <div className="plain-text-content">
                    {article.securityAdvisory.recommendedActionsEn}
                  </div>
                </div>
              ) : null}
              {article.securityAdvisory.referencesJson.length > 0 ? (
                <>
                  <h3>{messages.references}</h3>
                  <ul>
                    {article.securityAdvisory.referencesJson.map((reference) => (
                      <li key={reference.url}>
                        <a
                          href={reference.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                        >
                          {reference.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}
        </>
      )}
      <section className="admin-detail-card" aria-labelledby="workflow-title">
        <h2 id="workflow-title">{messages.editorialHistory}</h2>
        <AdminNewsWorkflow locale={locale} article={article} principal={principal} />
        <ol className="admin-status-history">
          {history.map((entry) => (
            <li key={entry.id}>
              <p>
                <strong>{messages.status[entry.toStatus]}</strong> · {entry.actor.displayName}
              </p>
              <time dateTime={entry.createdAt}>{dates.format(new Date(entry.createdAt))}</time>
              {entry.reason ? <p>{entry.reason}</p> : null}
            </li>
          ))}
        </ol>
      </section>
      {article.status === 'PUBLISHED' ? (
        <p className="admin-read-only-notice">{messages.notPublicWarning}</p>
      ) : null}
    </main>
  );
}
