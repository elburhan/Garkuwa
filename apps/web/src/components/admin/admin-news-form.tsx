'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import type { NewsArticle, NewsCategories } from '@/lib/admin-news-api';
import {
  createNewsArticle,
  updateNewsArticle,
  updateNewsMetadata,
} from '@/lib/admin-news-mutations';
import { buildStructuredArticleBody } from '@/lib/structured-article-content';

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
type MetadataDraft = {
  contributors: { contributorId: string; role: string; displayOrder: number }[];
  tagIds: string[];
  topicIds: string[];
  locations: { country: string; state: string | null; lga: string | null; place: string | null }[];
  sources: {
    type: string;
    publicLabel: string | null;
    organization: string | null;
    url: string | null;
    confidential: boolean;
    internalNotes: string | null;
    displayOrder: number;
  }[];
};
type ContributorProjection = {
  role: string;
  displayOrder?: number;
  contributor: { id: string; displayName: string };
};
type TagProjection = { tag: { id: string } };
type TopicProjection = { topic: { id: string } };
type LocationProjection = {
  country: string;
  state: string | null;
  lga: string | null;
  place: string | null;
};
type SourceProjection = MetadataDraft['sources'][number] & { displayOrder?: number };
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

function buildMutationPayload(content: Content, advisory: AdvisoryDraft): Record<string, unknown> {
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
  payload.bodyBlocksHa = buildStructuredArticleBody(content.bodyHa);
  payload.bodyBlocksEn = content.bodyEn.trim()
    ? buildStructuredArticleBody(content.bodyEn)
    : undefined;
  return payload;
}

function readRecovery(article: NewsArticle | undefined): Content | null {
  if (!article || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`garkuwa:news-recovery:${article.id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: string; content?: Content };
    return parsed.content &&
      typeof parsed.savedAt === 'string' &&
      new Date(parsed.savedAt).getTime() > new Date(article.updatedAt).getTime()
      ? parsed.content
      : null;
  } catch {
    return null;
  }
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
  const [language, setLanguage] = useState<'ha' | 'en'>('ha');
  const contributorProjections = (article?.contributors ?? []) as ContributorProjection[];
  const tagProjections = (article?.tags ?? []) as TagProjection[];
  const topicProjections = (article?.topics ?? []) as TopicProjection[];
  const locationProjections = (article?.locations ?? []) as LocationProjection[];
  const sourceProjections = (article?.sources ?? []) as SourceProjection[];
  const [metadata, setMetadata] = useState<MetadataDraft>({
    contributors:
      contributorProjections.map((item, index) => ({
        contributorId: item.contributor.id,
        role: item.role,
        displayOrder: item.displayOrder ?? index,
      })) ?? [],
    tagIds: tagProjections.map((item) => item.tag.id),
    topicIds: topicProjections.map((item) => item.topic.id),
    locations:
      locationProjections.map((location) => ({
        country: location.country,
        state: location.state,
        lga: location.lga,
        place: location.place,
      })) ?? [],
    sources: sourceProjections.map((source, index) => ({
      type: source.type,
      publicLabel: source.publicLabel,
      organization: source.organization,
      url: source.url,
      confidential: source.confidential,
      internalNotes: source.internalNotes,
      displayOrder: source.displayOrder ?? index,
    })),
  });
  const hasMetadata =
    metadata.contributors.length > 0 ||
    metadata.tagIds.length > 0 ||
    metadata.topicIds.length > 0 ||
    metadata.locations.length > 0 ||
    metadata.sources.length > 0;
  const [recovery, setRecovery] = useState<Content | null>(() => readRecovery(article));
  const version = useRef(article?.updatedAt ?? '');
  const lastSaved = useRef(JSON.stringify({ content, advisory }));
  const autosaveTimer = useRef<number | null>(null);
  const limits =
    content.categoryCode === 'LIVE_UPDATES'
      ? { title: 140, summaryMin: 10, summary: 280, bodyMin: 20, body: 1000 }
      : { title: 180, summaryMin: 20, summary: 500, bodyMin: 100, body: 50_000 };
  const recoveryKey = article ? `garkuwa:news-recovery:${article.id}` : null;

  useEffect(() => {
    if (!recoveryKey) return;
    window.localStorage.setItem(
      recoveryKey,
      JSON.stringify({ savedAt: new Date().toISOString(), content }),
    );
  }, [content, recoveryKey]);

  const change =
    (field: keyof Content) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setContent((current) => ({ ...current, [field]: event.target.value }));

  useEffect(() => {
    if (!article || pending || !valid(content, advisory)) return;
    const snapshot = JSON.stringify({ content, advisory });
    if (snapshot === lastSaved.current) return;
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(async () => {
      setNotice(messages.saving);
      let result = await updateNewsArticle(
        article.id,
        buildMutationPayload(content, advisory),
        version.current,
      );
      if (result.kind === 'error') {
        await new Promise((resolve) => window.setTimeout(resolve, 800));
        result = await updateNewsArticle(
          article.id,
          buildMutationPayload(content, advisory),
          version.current,
        );
      }
      if (result.kind === 'success') {
        const value = result.data as { article?: { updatedAt?: unknown } };
        if (typeof value.article?.updatedAt === 'string') version.current = value.article.updatedAt;
        lastSaved.current = snapshot;
        setNotice(messages.savedAutomatically);
        if (recoveryKey) window.localStorage.removeItem(recoveryKey);
        router.refresh();
      } else {
        setNotice(result.kind === 'conflict' ? messages.conflict : messages.saveFailed);
      }
    }, 1500);
    return () => {
      if (autosaveTimer.current !== null) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [content, advisory, article, messages, pending, recoveryKey, router]);

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
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    const payload = buildMutationPayload(content, advisory);
    const result = article
      ? await updateNewsArticle(article.id, payload, version.current)
      : await createNewsArticle(payload);
    setPending(false);
    if (result.kind === 'success') {
      setNotice(article ? messages.saved : messages.createdMessage);
      if (article) {
        if (hasMetadata) await updateNewsMetadata(article.id, metadata, version.current);
        const value = result.data as { article?: { updatedAt?: unknown } };
        if (typeof value.article?.updatedAt === 'string') version.current = value.article.updatedAt;
        lastSaved.current = JSON.stringify({ content, advisory });
        if (recoveryKey) window.localStorage.removeItem(recoveryKey);
        router.refresh();
      } else router.push(`/admin/news${locale === 'en' ? '?lang=en' : ''}`);
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
      {recovery ? (
        <aside className="admin-read-only-notice" role="status">
          <p>{messages.recoveryFound}</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setContent(recovery);
              setRecovery(null);
            }}
          >
            {messages.reviewRecovery}
          </button>{' '}
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              if (recoveryKey) window.localStorage.removeItem(recoveryKey);
              setRecovery(null);
            }}
          >
            {messages.discardRecovery}
          </button>
        </aside>
      ) : null}
      <p className="field-help">{messages.structuredTextGuidance}</p>
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
        <details className="admin-detail-card">
          <summary>{messages.moreOptions}</summary>
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
                        references: current.references.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
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
        </details>
      ) : null}
      <details className="admin-detail-card">
        <summary>{messages.moreOptions}</summary>
        <fieldset disabled={pending}>
          <legend>{messages.contributors}</legend>
          <p className="field-help">
            {contributorProjections.map((item) => item.contributor.displayName).join(', ') ||
              messages.noContributors}
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setNotice(messages.metadataSaved)}
          >
            {messages.addContributor}
          </button>
        </fieldset>
        <fieldset disabled={pending}>
          <legend>{messages.location}</legend>
          <input
            aria-label={messages.cityPlace}
            placeholder={messages.cityPlace}
            value={metadata.locations[0]?.place ?? ''}
            onChange={(event) =>
              setMetadata((current) => ({
                ...current,
                locations: [
                  {
                    country: current.locations[0]?.country ?? 'Nigeria',
                    state: current.locations[0]?.state ?? null,
                    lga: current.locations[0]?.lga ?? null,
                    place: event.target.value,
                  },
                ],
              }))
            }
          />
        </fieldset>
        <fieldset disabled={pending}>
          <legend>{messages.sources}</legend>
          <p className="field-help">
            {metadata.sources.length > 0 ? messages.sourcesAdded : messages.noSources}
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              setMetadata((current) => ({
                ...current,
                sources: [
                  ...current.sources,
                  {
                    type: 'OFFICIAL_STATEMENT',
                    publicLabel: '',
                    organization: '',
                    url: null,
                    confidential: false,
                    internalNotes: null,
                    displayOrder: current.sources.length,
                  },
                ],
              }))
            }
          >
            {messages.addSource}
          </button>
        </fieldset>
      </details>
      <fieldset disabled={pending}>
        <legend>
          {messages.hausaContent} · {messages.required}
        </legend>
        <nav className="news-language-links" aria-label={messages.languageTabs}>
          <button
            type="button"
            className="button"
            onClick={() => setLanguage('ha')}
            aria-pressed={language === 'ha'}
          >
            {messages.hausaContent} {messages.completeMark}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setLanguage('en')}
            aria-pressed={language === 'en'}
          >
            {messages.englishTranslation}{' '}
            {content.titleEn && content.summaryEn && content.bodyEn
              ? messages.completeMark
              : messages.incompleteMark}
          </button>
        </nav>
        {language !== 'ha' ? null : (
          <>
            {field('titleHa', messages.title, 5, limits.title)}
            {field('summaryHa', messages.summary, limits.summaryMin, limits.summary, true)}
            {field('bodyHa', messages.body, limits.bodyMin, limits.body, true)}
          </>
        )}
      </fieldset>
      <fieldset disabled={pending}>
        <legend>
          {messages.englishTranslation} · {messages.optional}
        </legend>
        <p className="field-help">{messages.translationGuidance}</p>
        <div hidden={language !== 'en'}>
          {field('titleEn', messages.title, 5, limits.title)}
          {field('summaryEn', messages.summary, limits.summaryMin, limits.summary, true)}
          {field('bodyEn', messages.body, limits.bodyMin, limits.body, true)}
        </div>
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
