'use client';

import { useEffect, useState } from 'react';

import { getMessages, type Locale } from '@/i18n';

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

export function formatRelativePublicationTime(
  publishedAt: string,
  now: number,
  locale: Locale,
): string {
  const elapsed = Math.max(0, now - new Date(publishedAt).getTime());
  const copy = getMessages(locale).publicNews;
  if (elapsed < minute) return copy.updatedJustNow;
  if (elapsed < 2 * minute) return copy.updatedOneMinuteAgo;
  if (elapsed < hour)
    return copy.updatedMinutesAgo.replace('{count}', String(Math.floor(elapsed / minute)));
  if (elapsed < 2 * hour) return copy.updatedOneHourAgo;
  if (elapsed < day)
    return copy.updatedHoursAgo.replace('{count}', String(Math.floor(elapsed / hour)));
  return new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
  }).format(new Date(publishedAt));
}

export function RelativePublicationTime({
  publishedAt,
  locale,
  initialNow,
}: Readonly<{ publishedAt: string; locale: Locale; initialNow?: number }>) {
  const [now, setNow] = useState(initialNow ?? new Date(publishedAt).getTime());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), minute);
    return () => window.clearInterval(interval);
  }, []);
  const exact = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(publishedAt));
  return (
    <time dateTime={publishedAt} title={exact}>
      {formatRelativePublicationTime(publishedAt, now, locale)}
      <span className="visually-hidden"> — {exact}</span>
    </time>
  );
}
