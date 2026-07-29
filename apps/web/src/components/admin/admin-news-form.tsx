'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import type { NewsArticle, NewsCategories } from '@/lib/admin-news-api';
import { createNewsArticle, updateNewsArticle } from '@/lib/admin-news-mutations';

type Content = {
  categoryCode: string;
  titleHa: string;
  summaryHa: string;
  bodyHa: string;
  titleEn: string;
  summaryEn: string;
  bodyEn: string;
};
type AdvisoryDraft = {
  severity: string;
  affectedAreaHa: string;
  affectedAreaEn: string;
  recommendedActionsHa: string;
  recommendedActionsEn: string;
  references: { label: string; url: string }[];
};
const emptyContent: Content = {
  categoryCode: '',
  titleHa: '',
  summaryHa: '',
  bodyHa: '',
  titleEn: '',
  summaryEn: '',
  bodyEn: '',
};
const emptyAdvisory: AdvisoryDraft = {
  severity: '',
  affectedAreaHa: '',
  affectedAreaEn: '',
  recommendedActionsHa: '',
  recommendedActionsEn: '',
  references: [],
};

function valid(content: Content, advisory: AdvisoryDraft): boolean {
  const limits =
    content.categoryCode === 'LIVE_UPDATES'
      ? { title: 140, summaryMin: 10, summary: 280, bodyMin: 20, body: 1000 }
      : { title: 180, summaryMin: 20, summary: 500, bodyMin: 100, body: 50_000 };
  const hausa =
    content.categoryCode.length > 0 &&
    content.titleHa.trim().length >= 5 &&
    content.titleHa.trim().length <= limits.title &&
    content.summaryHa.trim().length >= limits.summaryMin &&
    content.summaryHa.trim().length <= limits.summary &&
    content.bodyHa.trim().length >= limits.bodyMin &&
    content.bodyHa.trim().length <= limits.body;
  const englishCount = [content.titleEn, content.summaryEn, content.bodyEn].filter(
    (value) => value.trim().length > 0,
  ).length;
  const english =
    englishCount === 0 ||
    (englishCount === 3 &&
      content.titleEn.trim().length >= 5 &&
      content.titleEn.trim().length <= limits.title &&
      content.summaryEn.trim().length >= limits.summaryMin &&
      content.summaryEn.trim().length <= limits.summary &&
      content.bodyEn.trim().length >= limits.bodyMin &&
      content.bodyEn.trim().length <= limits.body);
  const advisoryValid =
    content.categoryCode !== 'SECURITY_ADVISORIES' ||
    (advisory.severity.length > 0 &&
      advisory.affectedAreaHa.trim().length >= 20 &&
      advisory.recommendedActionsHa.trim().length >= 30 &&
      Boolean(advisory.affectedAreaEn.trim()) === Boolean(advisory.recommendedActionsEn.trim()) &&
      advisory.references.every(
        (reference) =>
          reference.label.trim().length >= 2 && reference.url.trim().startsWith('https://'),
      ));
  return hausa && english && advisoryValid;
}

export function AdminNewsForm({
  locale,
  categories,
  article,
}: Readonly<{ locale: Locale; categories: NewsCategories['items']; article?: NewsArticle }>) {
  const messages = getMessages(locale).admin.news;
  const router = useRouter();
  const [content, setContent] = useState<Content>(
    article
      ? {
          categoryCode: article.category.code,
          titleHa: article.titleHa,
          summaryHa: article.summaryHa,
          bodyHa: article.bodyHa,
          titleEn: article.titleEn ?? '',
          summaryEn: article.summaryEn ?? '',
          bodyEn: article.bodyEn ?? '',
        }
      : emptyContent,
  );
  const [pending, setPending] = useState(false);
  const [advisory, setAdvisory] = useState<AdvisoryDraft>(
    article?.securityAdvisory
      ? {
          severity: article.securityAdvisory.severity,
          affectedAreaHa: article.securityAdvisory.affectedAreaHa,
          affectedAreaEn: article.securityAdvisory.affectedAreaEn ?? '',
          recommendedActionsHa: article.securityAdvisory.recommendedActionsHa,
          recommendedActionsEn: article.securityAdvisory.recommendedActionsEn ?? '',
          references: article.securityAdvisory.referencesJson,
        }
      : emptyAdvisory,
  );
  const [notice, setNotice] = useState('');
  const [invalid, setInvalid] = useState(false);
  const limits =
    content.categoryCode === 'LIVE_UPDATES'
      ? { title: 140, summaryMin: 10, summary: 280, bodyMin: 20, body: 1000 }
      : { title: 180, summaryMin: 20, summary: 500, bodyMin: 100, body: 50_000 };

  const change =
    (field: keyof Content) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setContent((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (!valid(content, advisory)) {
      setInvalid(true);
      setNotice(messages.validationError);
      return;
    }
    setInvalid(false);
    setPending(true);
    const payload: Record<string, unknown> = Object.fromEntries(
      Object.entries(content).map(([key, value]) => [key, value.trim() || null]),
    );
    payload.securityAdvisory =
      content.categoryCode === 'SECURITY_ADVISORIES'
        ? {
            severity: advisory.severity,
            affectedAreaHa: advisory.affectedAreaHa.trim(),
            affectedAreaEn: advisory.affectedAreaEn.trim() || null,
            recommendedActionsHa: advisory.recommendedActionsHa.trim(),
            recommendedActionsEn: advisory.recommendedActionsEn.trim() || null,
            references: advisory.references.map((reference) => ({
              label: reference.label.trim(),
              url: reference.url.trim(),
            })),
          }
        : null;
    const result = article
      ? await updateNewsArticle(article.id, payload, article.updatedAt)
      : await createNewsArticle(payload);
    setPending(false);
    if (result.kind === 'success') {
      setNotice(article ? messages.saved : messages.createdMessage);
      if (article) router.refresh();
      else router.push(`/admin/news${locale === 'en' ? '?lang=en' : ''}`);
    } else {
      setNotice(result.kind === 'conflict' ? messages.conflict : messages.actionFailed);
    }
  }

  const field = (
    name: keyof Content,
    label: string,
    minimum: number,
    maximum: number,
    multiline = false,
  ) => (
    <div className="admin-news-field">
      <label htmlFor={`news-${name}`}>{label}</label>
      {multiline ? (
        <textarea
          id={`news-${name}`}
          value={content[name]}
          onChange={change(name)}
          minLength={minimum}
          maxLength={maximum}
          rows={name.includes('body') || name.includes('Body') ? 12 : 4}
          aria-invalid={
            invalid && content[name].trim().length > 0 && content[name].trim().length < minimum
          }
        />
      ) : (
        <input
          id={`news-${name}`}
          value={content[name]}
          onChange={change(name)}
          minLength={minimum}
          maxLength={maximum}
        />
      )}
      <small>
        {content[name].length} / {maximum}
      </small>
    </div>
  );

  return (
    <form onSubmit={submit} className="admin-news-form" noValidate>
      <p className="field-help">{messages.plainTextGuidance}</p>
      <div className="admin-news-field">
        <label htmlFor="news-category">{messages.category}</label>
        <select
          id="news-category"
          required
          value={content.categoryCode}
          aria-invalid={invalid && !content.categoryCode}
          onChange={(event) =>
            setContent((current) => {
              if (
                current.categoryCode === 'SECURITY_ADVISORIES' &&
                event.target.value !== 'SECURITY_ADVISORIES' &&
                !window.confirm(messages.advisoryRemovalWarning)
              ) {
                return current;
              }
              return { ...current, categoryCode: event.target.value };
            })
          }
        >
          <option value="">{messages.selectCategory}</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>
              {locale === 'ha' ? category.nameHa : category.nameEn}
            </option>
          ))}
        </select>
        {content.categoryCode === 'LIVE_UPDATES' ? (
          <small>{messages.liveUpdateGuidance}</small>
        ) : (
          <small>{messages.categoryDraftOnly}</small>
        )}
      </div>
      {content.categoryCode === 'SECURITY_ADVISORIES' ? (
        <fieldset disabled={pending}>
          <legend>{messages.securityAdvisoryDetails}</legend>
          <p className="field-help">{messages.securityAdvisoryGuidance}</p>
          <div className="admin-news-field">
            <label htmlFor="advisory-severity">{messages.severity}</label>
            <select
              id="advisory-severity"
              required
              value={advisory.severity}
              onChange={(event) =>
                setAdvisory((current) => ({ ...current, severity: event.target.value }))
              }
            >
              <option value="">{messages.selectSeverity}</option>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'].map((severity) => (
                <option key={severity} value={severity}>
                  {messages.severityLabels[severity as keyof typeof messages.severityLabels]}
                </option>
              ))}
            </select>
          </div>
          {(
            [
              ['affectedAreaHa', messages.affectedAreaHa, 1000],
              ['recommendedActionsHa', messages.recommendedActionsHa, 3000],
              ['affectedAreaEn', messages.affectedAreaEn, 1000],
              ['recommendedActionsEn', messages.recommendedActionsEn, 3000],
            ] as const
          ).map(([name, label, maximum]) => (
            <div className="admin-news-field" key={String(name)}>
              <label htmlFor={`advisory-${name}`}>{label}</label>
              <textarea
                id={`advisory-${name}`}
                value={advisory[name as keyof Omit<AdvisoryDraft, 'references'>] as string}
                maxLength={Number(maximum)}
                rows={5}
                onChange={(event) =>
                  setAdvisory((current) => ({ ...current, [name]: event.target.value }))
                }
              />
            </div>
          ))}
          <fieldset>
            <legend>{messages.references}</legend>
            {advisory.references.map((reference, index) => (
              <div className="advisory-reference-row" key={`reference-${index}`}>
                <label htmlFor={`reference-label-${index}`}>{messages.referenceLabel}</label>
                <input
                  id={`reference-label-${index}`}
                  value={reference.label}
                  maxLength={160}
                  onChange={(event) =>
                    setAdvisory((current) => ({
                      ...current,
                      references: current.references.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item,
                      ),
                    }))
                  }
                />
                <label htmlFor={`reference-url-${index}`}>{messages.referenceUrl}</label>
                <input
                  id={`reference-url-${index}`}
                  type="url"
                  value={reference.url}
                  maxLength={2000}
                  onChange={(event) =>
                    setAdvisory((current) => ({
                      ...current,
                      references: current.references.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, url: event.target.value } : item,
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() =>
                    setAdvisory((current) => ({
                      ...current,
                      references: current.references.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  {messages.removeReference} {index + 1}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button button-secondary"
              disabled={advisory.references.length >= 10}
              onClick={() =>
                setAdvisory((current) => ({
                  ...current,
                  references: [...current.references, { label: '', url: '' }],
                }))
              }
            >
              {messages.addReference}
            </button>
          </fieldset>
        </fieldset>
      ) : null}
      <fieldset disabled={pending}>
        <legend>
          {messages.hausaContent} · {messages.required}
        </legend>
        {field('titleHa', messages.title, 5, limits.title)}
        {field('summaryHa', messages.summary, limits.summaryMin, limits.summary, true)}
        {field('bodyHa', messages.body, limits.bodyMin, limits.body, true)}
      </fieldset>
      <fieldset disabled={pending}>
        <legend>
          {messages.englishTranslation} · {messages.optional}
        </legend>
        <p className="field-help">{messages.translationGuidance}</p>
        {field('titleEn', messages.title, 5, limits.title)}
        {field('summaryEn', messages.summary, limits.summaryMin, limits.summary, true)}
        {field('bodyEn', messages.body, limits.bodyMin, limits.body, true)}
      </fieldset>
      <button className="button" type="submit" disabled={pending}>
        {pending ? messages.saving : article ? messages.saveDraft : messages.createArticle}
      </button>
      <p role="alert" aria-live="polite">
        {notice}
      </p>
    </form>
  );
}
