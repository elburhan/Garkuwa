import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { RichArticleBody } from '@/components/public/rich-article-body';
import { getMessages, type Locale } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { adminMediaContentUrl } from '@/lib/admin-media-api';
import { loadNewsPreview } from '@/lib/admin-news-api';

export default async function ArticlePreviewPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ articleId: string }>; searchParams: Promise<{ lang?: string }> }>) {
  const [{ articleId }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = query.lang === 'en' ? 'en' : 'ha';
  if (!(await getAdminPrincipal())) redirect(`/admin/login?lang=${locale}&reason=expired`);
  const result = await loadNewsPreview(articleId);
  if (result.kind === 'not-found') notFound();
  if (result.kind !== 'success') redirect(`/admin/news/${articleId}?lang=${locale}`);
  const article = result.data.article;
  const copy = getMessages(locale).admin.news;
  const revision = (article.revisions?.[0] ?? null) as {
    bodyBlocksHa?: unknown;
    bodyBlocksEn?: unknown;
  } | null;
  const english = locale === 'en' && article.titleEn && article.summaryEn && article.bodyEn;
  const inlineMedia = (article.media ?? []).map(({ media }) => ({
    id: media.id,
    url: adminMediaContentUrl(media.id),
    mimeType: media.mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
    width: media.width ?? 1,
    height: media.height ?? 1,
    altText: english ? (media.altTextEn ?? media.altTextHa) : media.altTextHa,
    caption: english ? (media.captionEn ?? media.captionHa) : media.captionHa,
    credit: media.credit,
  }));
  return (
    <main className="content-width public-article section-spacing" lang={english ? 'en' : 'ha'}>
      <p className="admin-read-only-notice">{copy.previewNotice}</p>
      <Link href={`/admin/news/${articleId}${locale === 'en' ? '?lang=en' : ''}`}>
        {copy.backToEditor}
      </Link>
      <p className="eyebrow">
        {locale === 'en' ? article.category.nameEn : article.category.nameHa}
      </p>
      <h1>{english ? article.titleEn : article.titleHa}</h1>
      <p className="public-news-summary">{english ? article.summaryEn : article.summaryHa}</p>
      <p>{article.author.displayName}</p>
      {article.featuredMedia ? (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={adminMediaContentUrl(article.featuredMedia.id)}
            alt={
              english
                ? (article.featuredMedia.altTextEn ?? article.featuredMedia.altTextHa)
                : article.featuredMedia.altTextHa
            }
            width={article.featuredMedia.width ?? 1200}
            height={article.featuredMedia.height ?? 675}
          />
          {article.featuredMedia.captionHa || article.featuredMedia.credit ? (
            <figcaption>
              {english
                ? (article.featuredMedia.captionEn ?? article.featuredMedia.captionHa)
                : article.featuredMedia.captionHa}
              {article.featuredMedia.credit ? ` · ${article.featuredMedia.credit}` : ''}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      <RichArticleBody
        blocks={english ? revision?.bodyBlocksEn : revision?.bodyBlocksHa}
        fallback={english ? article.bodyEn! : article.bodyHa}
        media={inlineMedia}
      />
      {(article.media ?? []).some((item) => item.role === 'GALLERY') ? (
        <section
          className="public-news-gallery"
          aria-label={getMessages(locale).publicNews.galleryLabel}
        >
          {(article.media ?? [])
            .filter((item) => item.role === 'GALLERY')
            .map(({ media }) => (
              <figure key={media.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={adminMediaContentUrl(media.id)}
                  alt={english ? (media.altTextEn ?? media.altTextHa) : media.altTextHa}
                  width={media.width ?? 1}
                  height={media.height ?? 1}
                  loading="lazy"
                />
                {media.captionHa || media.credit ? (
                  <figcaption>
                    {english ? (media.captionEn ?? media.captionHa) : media.captionHa}
                    {media.credit ? ` · ${media.credit}` : ''}
                  </figcaption>
                ) : null}
              </figure>
            ))}
        </section>
      ) : null}
    </main>
  );
}
