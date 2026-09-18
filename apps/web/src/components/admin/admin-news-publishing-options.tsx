'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import type { NewsArticle } from '@/lib/admin-news-api';
import { addNewsCorrection, updateNewsPublishingMetadata } from '@/lib/admin-news-mutations';

export function AdminNewsPublishingOptions({
  locale,
  article,
}: Readonly<{ locale: Locale; article: NewsArticle }>) {
  const copy = getMessages(locale).admin.news;
  const router = useRouter();
  const [featured, setFeatured] = useState(article.isFeatured ?? false);
  const [breaking, setBreaking] = useState(article.isBreaking ?? false);
  const [noteHa, setNoteHa] = useState('');
  const [noteEn, setNoteEn] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');

  async function savePublishingOptions() {
    setPending(true);
    const result = await updateNewsPublishingMetadata(article.id, {
      isFeatured: featured,
      isBreaking: breaking,
      expectedUpdatedAt: article.updatedAt,
    });
    setPending(false);
    setNotice(
      result.kind === 'success'
        ? copy.publishingOptionsSaved
        : result.kind === 'conflict'
          ? copy.conflict
          : copy.actionFailed,
    );
    if (result.kind === 'success') router.refresh();
  }

  async function saveCorrection() {
    if (noteHa.trim().length < 10 || (noteEn.trim() && noteEn.trim().length < 10)) return;
    setPending(true);
    const result = await addNewsCorrection(article.id, {
      noteHa,
      noteEn: noteEn.trim() || null,
      expectedUpdatedAt: article.updatedAt,
    });
    setPending(false);
    setNotice(
      result.kind === 'success'
        ? copy.correctionSaved
        : result.kind === 'conflict'
          ? copy.conflict
          : copy.actionFailed,
    );
    if (result.kind === 'success') {
      setNoteHa('');
      setNoteEn('');
      router.refresh();
    }
  }

  return (
    <section className="admin-detail-card" aria-labelledby="publishing-options-title">
      <h2 id="publishing-options-title">{copy.publishingOptions}</h2>
      <fieldset>
        <legend>{copy.publishingOptions}</legend>
        <label>
          <input
            type="checkbox"
            checked={featured}
            onChange={(event) => setFeatured(event.target.checked)}
          />{' '}
          {copy.featuredStory}
        </label>
        <label>
          <input
            type="checkbox"
            checked={breaking}
            disabled={article.status !== 'PUBLISHED'}
            onChange={(event) => setBreaking(event.target.checked)}
          />{' '}
          {copy.breakingNews}
        </label>
        {article.status !== 'PUBLISHED' ? <p>{copy.breakingPublishedOnly}</p> : null}
      </fieldset>
      <button type="button" className="button" disabled={pending} onClick={savePublishingOptions}>
        {copy.savePublishingOptions}
      </button>

      {article.status === 'PUBLISHED' ? (
        <fieldset>
          <legend>{copy.corrections}</legend>
          <p>{copy.correctionGuidance}</p>
          <label htmlFor="correction-note-ha">{copy.correctionNoteHa}</label>
          <textarea
            id="correction-note-ha"
            minLength={10}
            maxLength={2000}
            required
            value={noteHa}
            onChange={(event) => setNoteHa(event.target.value)}
          />
          <label htmlFor="correction-note-en">{copy.correctionNoteEn}</label>
          <textarea
            id="correction-note-en"
            minLength={10}
            maxLength={2000}
            value={noteEn}
            onChange={(event) => setNoteEn(event.target.value)}
          />
          <button type="button" className="button" disabled={pending} onClick={saveCorrection}>
            {copy.saveCorrection}
          </button>
          {(article.corrections ?? []).length > 0 ? (
            <ol>
              {(article.corrections ?? []).map((correction) => (
                <li key={correction.id}>
                  <p>
                    {locale === 'en' ? (correction.noteEn ?? correction.noteHa) : correction.noteHa}
                  </p>
                  <time dateTime={correction.createdAt}>{correction.createdAt}</time>
                </li>
              ))}
            </ol>
          ) : null}
        </fieldset>
      ) : null}
      <p role="status" aria-live="polite">
        {notice}
      </p>
    </section>
  );
}
