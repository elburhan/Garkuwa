'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import type {
  InstitutionalHistory,
  InstitutionalPageDetail,
  InstitutionalRevisions,
} from '@/lib/admin-institutional-content-api';
import {
  saveInstitutionalDraft,
  transitionInstitutionalPage,
} from '@/lib/admin-institutional-content-mutations';

interface EditableSection {
  sectionKey: string;
  headingHa: string;
  bodyHa: string;
  headingEn: string;
  bodyEn: string;
}

export function AdminInstitutionalContentEditor({
  locale,
  page,
  revisions,
  history,
}: Readonly<{
  locale: Locale;
  page: InstitutionalPageDetail;
  revisions: InstitutionalRevisions;
  history: InstitutionalHistory;
}>) {
  const copy = getMessages(locale).institutionalContent.admin;
  const router = useRouter();
  const source = page.draftRevision ?? page.publishedRevision;
  const [titleHa, setTitleHa] = useState(source?.titleHa ?? '');
  const [summaryHa, setSummaryHa] = useState(source?.summaryHa ?? '');
  const [titleEn, setTitleEn] = useState(source?.titleEn ?? '');
  const [summaryEn, setSummaryEn] = useState(source?.summaryEn ?? '');
  const [sections, setSections] = useState<EditableSection[]>(
    source?.sections.map((section) => ({
      ...section,
      headingEn: section.headingEn ?? '',
      bodyEn: section.bodyEn ?? '',
    })) ?? [],
  );
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');

  function updateSection(index: number, field: keyof EditableSection, value: string) {
    setSections((current) =>
      current.map((section, position) =>
        position === index ? { ...section, [field]: value } : section,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    setSections((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function remove(index: number) {
    const section = sections[index];
    if (
      section &&
      Object.values(section).some((value) => value.trim()) &&
      !window.confirm(copy.confirmRemove)
    )
      return;
    setSections((current) => current.filter((_, position) => position !== index));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await saveInstitutionalDraft(
      page.pageKey,
      { titleHa, summaryHa, titleEn, summaryEn, sections },
      page.updatedAt,
    );
    setPending(false);
    setNotice(
      result.kind === 'success'
        ? copy.saved
        : result.kind === 'conflict'
          ? copy.conflict
          : copy.validationError,
    );
    if (result.kind === 'success') router.refresh();
  }

  async function transition(decision: 'SUBMIT_FOR_REVIEW' | 'RETURN_TO_DRAFT' | 'PUBLISH') {
    if (!confirmed || (decision === 'RETURN_TO_DRAFT' && reason.trim().length < 10)) {
      setNotice(copy.validationError);
      return;
    }
    setPending(true);
    const result = await transitionInstitutionalPage(
      page.pageKey,
      decision,
      page.updatedAt,
      reason.trim() || undefined,
    );
    setPending(false);
    setNotice(
      result.kind === 'success'
        ? copy.actionSucceeded
        : result.kind === 'conflict'
          ? copy.conflict
          : copy.actionFailed,
    );
    if (result.kind === 'success') router.refresh();
  }

  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">{copy.pageNames[page.pageKey]}</p>
          <h1>{copy.editPage}</h1>
          <p>
            {page.routes.ha} / {page.routes.en}
          </p>
          <p>
            {copy.statusLabel}: {copy.status[page.workflowStatus]}
          </p>
        </div>
        <Link href={`/admin/content?lang=${locale}`}>{copy.backToList}</Link>
      </header>

      {page.allowedActions.saveDraft ? (
        <form className="admin-content-editor" onSubmit={save}>
          <fieldset disabled={pending}>
            <legend>{copy.hausaContent}</legend>
            <label>
              {copy.titleLabel}
              <input
                value={titleHa}
                onChange={(event) => setTitleHa(event.target.value)}
                minLength={5}
                maxLength={180}
                required
              />
            </label>
            <label>
              {copy.summaryLabel}
              <textarea
                value={summaryHa}
                onChange={(event) => setSummaryHa(event.target.value)}
                maxLength={500}
              />
            </label>
          </fieldset>
          <fieldset disabled={pending}>
            <legend>{copy.englishContent}</legend>
            <p>{copy.englishCompleteness}</p>
            <label>
              {copy.titleLabel}
              <input
                value={titleEn}
                onChange={(event) => setTitleEn(event.target.value)}
                maxLength={180}
              />
            </label>
            <label>
              {copy.summaryLabel}
              <textarea
                value={summaryEn}
                onChange={(event) => setSummaryEn(event.target.value)}
                maxLength={500}
              />
            </label>
          </fieldset>

          <fieldset disabled={pending}>
            <legend>{copy.sections}</legend>
            {sections.map((section, index) => (
              <section className="admin-section-editor" key={`${section.sectionKey}-${index}`}>
                <h2>
                  {copy.section} {index + 1}
                </h2>
                <label>
                  {copy.sectionKey}
                  <input
                    value={section.sectionKey}
                    onChange={(event) => updateSection(index, 'sectionKey', event.target.value)}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                  />
                </label>
                <label>
                  {copy.headingHa}
                  <input
                    value={section.headingHa}
                    onChange={(event) => updateSection(index, 'headingHa', event.target.value)}
                    required
                  />
                </label>
                <label>
                  {copy.bodyHa}
                  <textarea
                    value={section.bodyHa}
                    onChange={(event) => updateSection(index, 'bodyHa', event.target.value)}
                    required
                  />
                </label>
                <label>
                  {copy.headingEn}
                  <input
                    value={section.headingEn}
                    onChange={(event) => updateSection(index, 'headingEn', event.target.value)}
                  />
                </label>
                <label>
                  {copy.bodyEn}
                  <textarea
                    value={section.bodyEn}
                    onChange={(event) => updateSection(index, 'bodyEn', event.target.value)}
                  />
                </label>
                <div className="action-row">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>
                    {copy.moveUp}
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === sections.length - 1}
                  >
                    {copy.moveDown}
                  </button>
                  <button type="button" onClick={() => remove(index)}>
                    {copy.removeSection}
                  </button>
                </div>
              </section>
            ))}
            <button
              type="button"
              onClick={() =>
                setSections((current) => [
                  ...current,
                  {
                    sectionKey: `section-${current.length + 1}`,
                    headingHa: '',
                    bodyHa: '',
                    headingEn: '',
                    bodyEn: '',
                  },
                ])
              }
              disabled={sections.length >= 20}
            >
              {copy.addSection}
            </button>
          </fieldset>
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? copy.saving : copy.saveDraft}
          </button>
        </form>
      ) : (
        <p className="admin-read-only-notice">{copy.readOnly}</p>
      )}

      {(page.allowedActions.submit ||
        page.allowedActions.return ||
        page.allowedActions.publish) && (
        <section className="admin-detail-card">
          <h2>{copy.workflow}</h2>
          {page.allowedActions.return ? (
            <label>
              {copy.returnReason}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={10}
                maxLength={1000}
              />
            </label>
          ) : null}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {page.allowedActions.publish ? copy.cacheDelayWarning : copy.confirmAction}
          </label>
          <div className="action-row">
            {page.allowedActions.submit ? (
              <button type="button" onClick={() => transition('SUBMIT_FOR_REVIEW')}>
                {copy.submitForReview}
              </button>
            ) : null}
            {page.allowedActions.return ? (
              <button type="button" onClick={() => transition('RETURN_TO_DRAFT')}>
                {copy.returnForCorrection}
              </button>
            ) : null}
            {page.allowedActions.publish ? (
              <button type="button" onClick={() => transition('PUBLISH')}>
                {copy.publishRevision}
              </button>
            ) : null}
          </div>
        </section>
      )}
      <p role="status" aria-live="polite">
        {notice}
      </p>

      <section className="admin-detail-card">
        <h2>{copy.revisionHistory}</h2>
        <ol className="admin-status-history">
          {revisions.items.map((revision) => (
            <li key={revision.id}>
              <details>
                <summary>
                  {copy.version} {revision.version}
                  {revision.isPublished ? ` — ${copy.publishedVersion}` : ''}
                  {revision.isDraft ? ` — ${copy.draftVersion}` : ''}
                </summary>
                <p>{revision.titleHa}</p>
                <p>{revision.englishComplete ? copy.englishComplete : copy.hausaOnly}</p>
                {revision.sections.map((section) => (
                  <div key={section.sectionKey}>
                    <h3>{section.headingHa}</h3>
                    <p className="plain-text-content">{section.bodyHa}</p>
                  </div>
                ))}
              </details>
            </li>
          ))}
        </ol>
      </section>
      <section className="admin-detail-card">
        <h2>{copy.workflowHistory}</h2>
        <ol className="admin-status-history">
          {history.items.map((entry) => (
            <li key={entry.id}>
              <p>
                {copy.version} {entry.revision.version}: {copy.status[entry.toStatus]}
              </p>
              <time dateTime={entry.createdAt}>{entry.createdAt}</time>
              <p>{entry.actor?.displayName ?? copy.migratedContent}</p>
              {entry.reason ? <p>{entry.reason}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
