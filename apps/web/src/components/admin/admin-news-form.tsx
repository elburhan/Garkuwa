'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import type { NewsArticle } from '@/lib/admin-news-api';
import { createNewsArticle, updateNewsArticle } from '@/lib/admin-news-mutations';

type Content = {
  titleHa: string;
  summaryHa: string;
  bodyHa: string;
  titleEn: string;
  summaryEn: string;
  bodyEn: string;
};
const emptyContent: Content = {
  titleHa: '',
  summaryHa: '',
  bodyHa: '',
  titleEn: '',
  summaryEn: '',
  bodyEn: '',
};

function valid(content: Content): boolean {
  const hausa =
    content.titleHa.trim().length >= 5 &&
    content.summaryHa.trim().length >= 20 &&
    content.bodyHa.trim().length >= 100;
  const englishCount = [content.titleEn, content.summaryEn, content.bodyEn].filter(
    (value) => value.trim().length > 0,
  ).length;
  const english =
    englishCount === 0 ||
    (englishCount === 3 &&
      content.titleEn.trim().length >= 5 &&
      content.summaryEn.trim().length >= 20 &&
      content.bodyEn.trim().length >= 100);
  return hausa && english;
}

export function AdminNewsForm({
  locale,
  article,
}: Readonly<{ locale: Locale; article?: NewsArticle }>) {
  const messages = getMessages(locale).admin.news;
  const router = useRouter();
  const [content, setContent] = useState<Content>(
    article
      ? {
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
  const [notice, setNotice] = useState('');
  const [invalid, setInvalid] = useState(false);

  const change =
    (field: keyof Content) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setContent((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (!valid(content)) {
      setInvalid(true);
      setNotice(messages.validationError);
      return;
    }
    setInvalid(false);
    setPending(true);
    const payload = Object.fromEntries(
      Object.entries(content).map(([key, value]) => [key, value.trim() || null]),
    ) as Record<string, string | null>;
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
      <fieldset disabled={pending}>
        <legend>
          {messages.hausaContent} · {messages.required}
        </legend>
        {field('titleHa', messages.title, 5, 180)}
        {field('summaryHa', messages.summary, 20, 500, true)}
        {field('bodyHa', messages.body, 100, 50_000, true)}
      </fieldset>
      <fieldset disabled={pending}>
        <legend>
          {messages.englishTranslation} · {messages.optional}
        </legend>
        <p className="field-help">{messages.translationGuidance}</p>
        {field('titleEn', messages.title, 5, 180)}
        {field('summaryEn', messages.summary, 20, 500, true)}
        {field('bodyEn', messages.body, 100, 50_000, true)}
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
