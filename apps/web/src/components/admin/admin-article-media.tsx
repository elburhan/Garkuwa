'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import { adminMediaContentUrl, type AdminMedia } from '@/lib/admin-media-api';
import type { NewsArticle } from '@/lib/admin-news-api';
import { updateNewsArticleMedia } from '@/lib/admin-news-mutations';

export function AdminArticleMedia({
  locale,
  article,
  media,
}: Readonly<{ locale: Locale; article: NewsArticle; media: AdminMedia[] }>) {
  const messages = getMessages(locale).admin.media;
  const router = useRouter();
  const [featured, setFeatured] = useState<string | null>(article.featuredMedia?.id ?? null);
  const [social, setSocial] = useState<string | null>(article.socialMedia?.id ?? null);
  const [gallery, setGallery] = useState<string[]>(
    (article.media ?? []).filter((item) => item.role === 'GALLERY').map((item) => item.media.id),
  );
  const [inline, setInline] = useState<string[]>(
    (article.media ?? []).filter((item) => item.role === 'INLINE').map((item) => item.media.id),
  );
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');

  function move(index: number, offset: number) {
    setGallery((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function save() {
    setPending(true);
    const result = await updateNewsArticleMedia(article.id, {
      featuredMediaId: featured,
      socialMediaId: social,
      galleryMediaIds: gallery,
      inlineMediaIds: inline,
      expectedUpdatedAt: article.updatedAt,
    });
    setPending(false);
    setNotice(
      result.kind === 'success'
        ? messages.selectionSaved
        : result.kind === 'conflict'
          ? getMessages(locale).admin.news.conflict
          : messages.failed,
    );
    if (result.kind === 'success') router.refresh();
  }

  return (
    <section className="admin-detail-card" aria-labelledby="article-media-title">
      <h2 id="article-media-title">{messages.featuredImage}</h2>
      <p>{messages.isolation}</p>
      {featured ? (
        <div>
          {media
            .filter((item) => item.id === featured)
            .map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.id}
                src={adminMediaContentUrl(item.id)}
                alt={item.altTextHa}
                width={item.width ?? 480}
                height={item.height ?? 270}
              />
            ))}
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setFeatured(null)}
          >
            {messages.remove}
          </button>
        </div>
      ) : null}
      <div className="admin-media-grid">
        {media.map((item) => (
          <div key={item.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={adminMediaContentUrl(item.id)}
              alt={item.altTextHa}
              width={160}
              height={100}
              loading="lazy"
            />
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setFeatured(item.id)}
            >
              {messages.setFeatured}
            </button>
            {!gallery.includes(item.id) ? (
              <button type="button" onClick={() => setGallery((current) => [...current, item.id])}>
                {messages.addToGallery}
              </button>
            ) : null}
            {!inline.includes(item.id) ? (
              <button
                type="button"
                onClick={async () => {
                  setInline((current) => [...current, item.id]);
                  await navigator.clipboard?.writeText(`[image:${item.id}]`);
                  setNotice(messages.inlineCopied);
                }}
              >
                {messages.insertInline}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <h3>{messages.gallery}</h3>
      <ol>
        {gallery.map((id, index) => {
          const item = media.find((candidate) => candidate.id === id);
          return (
            <li key={id}>
              {item?.captionHa ?? item?.originalFilename ?? id}
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>
                {messages.moveUp}
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === gallery.length - 1}
              >
                {messages.moveDown}
              </button>
              <button
                type="button"
                onClick={() => setGallery((current) => current.filter((value) => value !== id))}
              >
                {messages.remove}
              </button>
            </li>
          );
        })}
      </ol>
      <details>
        <summary>{messages.socialImage}</summary>
        <p>{messages.socialImageGuidance}</p>
        <select value={social ?? ''} onChange={(event) => setSocial(event.target.value || null)}>
          <option value="">{messages.useFeaturedForSocial}</option>
          {media.map((item) => (
            <option key={item.id} value={item.id}>
              {item.captionHa ?? item.originalFilename}
            </option>
          ))}
        </select>
      </details>
      <h3>{messages.inlineImages}</h3>
      <p>{messages.inlineGuidance}</p>
      <ul>
        {inline.map((id) => {
          const item = media.find((candidate) => candidate.id === id);
          return (
            <li key={id}>
              {item?.captionHa ?? item?.originalFilename ?? id}
              <button
                type="button"
                onClick={() => setInline((current) => current.filter((value) => value !== id))}
              >
                {messages.remove}
              </button>
            </li>
          );
        })}
      </ul>
      <p>
        <Link href={`/admin/media${locale === 'en' ? '?lang=en' : ''}`}>{messages.upload}</Link>
      </p>
      <button type="button" className="button" disabled={pending} onClick={save}>
        {pending ? messages.uploading : messages.saveSelection}
      </button>
      <p role="status" aria-live="polite">
        {notice}
      </p>
    </section>
  );
}
