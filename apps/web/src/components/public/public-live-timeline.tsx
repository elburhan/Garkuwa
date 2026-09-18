'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { PublicLiveUpdate } from '@garkuwa/contracts/live';
import { loadIncrementalLiveUpdates, loadPublicLiveEvent } from '@/lib/public-live-api';
import { publicNewsMediaUrl } from '@/lib/public-news-api';

const labels = {
  ha: {
    key: 'Muhimmin sabuntawa',
    withdrawn: 'Ƙungiyar edita ta janye wannan sabuntawa.',
    corrected: 'An gyara',
    newer: 'sabbin sabuntawa',
    older: 'Nemo tsofaffin sabuntawa',
    copy: 'Kwafi mahaɗi',
    copied: 'An kwafa',
  },
  en: {
    key: 'Key update',
    withdrawn: 'This update was withdrawn by the editorial team.',
    corrected: 'Updated',
    newer: 'new updates',
    older: 'Load older updates',
    copy: 'Copy link',
    copied: 'Copied',
  },
} as const;

export function PublicLiveTimeline({
  slug,
  locale,
  initialUpdates,
  initialLatestSequence,
  initialHasOlder,
  initialCheckedAt,
}: Readonly<{
  slug: string;
  locale: 'ha' | 'en';
  initialUpdates: PublicLiveUpdate[];
  initialLatestSequence: number;
  initialHasOlder: boolean;
  initialCheckedAt: string;
}>) {
  const copy = labels[locale];
  const [updates, setUpdates] = useState(initialUpdates);
  const [latestSequence, setLatestSequence] = useState(initialLatestSequence);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [pending, setPending] = useState<PublicLiveUpdate[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const checkedAt = useRef(initialCheckedAt);
  const ordered = useMemo(() => [...updates].sort((a, b) => b.sequence - a.sequence), [updates]);

  useEffect(() => {
    const poll = async () => {
      if (document.hidden) return;
      const result = await loadIncrementalLiveUpdates(
        slug,
        locale,
        latestSequence,
        checkedAt.current,
      );
      if (result.kind !== 'success') return;
      checkedAt.current = result.data.generatedAt;
      setLatestSequence(result.data.latestSequence);
      const changed = result.data.updates.filter((item) => item.sequence <= latestSequence);
      const incoming = result.data.updates
        .filter((item) => item.sequence > latestSequence)
        .sort((a, b) => b.sequence - a.sequence);
      if (changed.length > 0) {
        setUpdates((current) =>
          current.map((item) => changed.find((next) => next.id === item.id) ?? item),
        );
      }
      if (incoming.length === 0) return;
      if (window.scrollY < 240) setUpdates((current) => [...incoming, ...current]);
      else setPending((current) => [...incoming, ...current]);
    };
    const timer = window.setInterval(() => void poll(), 12_000);
    return () => window.clearInterval(timer);
  }, [latestSequence, locale, slug]);

  async function loadOlder() {
    const oldest = ordered.at(-1)?.sequence;
    if (!oldest) return;
    const result = await loadPublicLiveEvent(slug, locale, oldest);
    if (result.kind !== 'success') return;
    setUpdates((current) => [...current, ...result.data.updates]);
    setHasOlder(result.data.hasOlder);
  }

  function showPending() {
    setUpdates((current) => [...pending, ...current]);
    setPending([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function copyLink(sequence: number) {
    const url = `${window.location.origin}${window.location.pathname}#update-${sequence}`;
    await navigator.clipboard.writeText(url);
    setCopied(sequence);
  }

  return (
    <>
      {pending.length > 0 ? (
        <button className="live-new-updates" type="button" onClick={showPending}>
          {pending.length} {copy.newer}
        </button>
      ) : null}
      <ol className="public-live-updates-feed" aria-live="polite">
        {ordered.map((update) => (
          <li key={update.id} id={`update-${update.sequence}`}>
            <time dateTime={update.createdAt}>
              {new Date(update.createdAt).toLocaleString(locale)}
            </time>
            {update.isPinned ? <strong className="live-key-update">{copy.key}</strong> : null}
            {update.isWithdrawn ? (
              <p>{copy.withdrawn}</p>
            ) : (
              <>
                {update.headline ? <h2>{update.headline}</h2> : null}
                <p>{update.body}</p>
                {update.media ? (
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={publicNewsMediaUrl(update.media.url)}
                      alt={update.media.altText}
                      width={update.media.width}
                      height={update.media.height}
                      loading="lazy"
                    />
                    {update.media.caption || update.media.credit ? (
                      <figcaption>
                        {update.media.caption}
                        {update.media.caption && update.media.credit ? ' · ' : ''}
                        {update.media.credit}
                      </figcaption>
                    ) : null}
                  </figure>
                ) : null}
                {update.correctedAt ? (
                  <p>
                    <small>
                      {copy.corrected}{' '}
                      <time dateTime={update.correctedAt}>
                        {new Date(update.correctedAt).toLocaleString(locale)}
                      </time>
                    </small>
                  </p>
                ) : null}
              </>
            )}
            <button type="button" onClick={() => void copyLink(update.sequence)}>
              {copied === update.sequence ? copy.copied : copy.copy}
            </button>
          </li>
        ))}
      </ol>
      {hasOlder ? (
        <button type="button" onClick={() => void loadOlder()}>
          {copy.older}
        </button>
      ) : null}
    </>
  );
}
