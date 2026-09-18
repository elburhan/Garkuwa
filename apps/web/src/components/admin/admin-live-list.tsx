'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { getMessages, type Locale } from '@/i18n';
import type { AdminLiveEventList } from '@/lib/admin-live-api';
import { createLiveEvent } from '@/lib/admin-live-api';

export function AdminLiveList({
  locale,
  events,
  categories,
  canCreate,
}: Readonly<{
  locale: Locale;
  events: AdminLiveEventList;
  categories: { code: string; nameHa: string; nameEn: string | null }[];
  canCreate: boolean;
}>) {
  const messages = getMessages(locale).admin.live;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setNotice('');
    const result = await createLiveEvent({
      categoryCode: String(values.get('categoryCode') ?? ''),
      titleHa: String(values.get('titleHa') ?? ''),
      titleEn: String(values.get('titleEn') ?? '').trim() || null,
      summaryHa: String(values.get('summaryHa') ?? '').trim() || null,
      summaryEn: String(values.get('summaryEn') ?? '').trim() || null,
    });
    setPending(false);
    if (result.kind === 'success') {
      setNotice(messages.created);
      form.reset();
      router.refresh();
      const data = result.data as { event?: { id?: string } };
      if (data.event?.id) router.push(`/admin/live/${data.event.id}?lang=${locale}`);
    } else {
      setNotice(messages.failed);
    }
  }

  return (
    <>
      {canCreate ? (
        <form className="admin-news-form" onSubmit={create}>
          <fieldset disabled={pending}>
            <legend>{messages.newEvent}</legend>
            <label htmlFor="live-category">{messages.category}</label>
            <select id="live-category" name="categoryCode" required defaultValue="">
              <option value="" disabled>
                {messages.category}
              </option>
              {categories.map((category) => (
                <option key={category.code} value={category.code}>
                  {locale === 'en' ? (category.nameEn ?? category.nameHa) : category.nameHa}
                </option>
              ))}
            </select>
            <label htmlFor="live-title">{messages.titleHa}</label>
            <input id="live-title" name="titleHa" minLength={1} maxLength={180} required />
            <label htmlFor="live-title-en">English title (optional)</label>
            <input id="live-title-en" name="titleEn" minLength={1} maxLength={180} />
            <label htmlFor="live-summary">{messages.summaryHa}</label>
            <textarea id="live-summary" name="summaryHa" maxLength={500} />
            <label htmlFor="live-summary-en">English summary (optional)</label>
            <textarea id="live-summary-en" name="summaryEn" maxLength={500} />
            <button type="submit">{messages.create}</button>
          </fieldset>
          <p role="status">{notice}</p>
        </form>
      ) : null}
      {events.items.length === 0 ? (
        <p>{messages.empty}</p>
      ) : (
        <ul className="admin-live-event-list">
          {events.items.map((item) => (
            <li key={item.id}>
              <Link href={`/admin/live/${item.id}?lang=${locale}`}>{item.titleHa}</Link>
              <span> — {messages.status[item.status]}</span>
              {item.isFeatured ? <span> · {messages.feature}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
