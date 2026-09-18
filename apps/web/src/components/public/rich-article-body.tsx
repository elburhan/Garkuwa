import {
  richArticleBodySchema,
  type PublicMedia,
  type RichArticleBody,
} from '@garkuwa/contracts/media';

function spans(content: Extract<RichArticleBody[number], { content: unknown }>['content']) {
  return content.map((span, index) => {
    let node: React.ReactNode = span.text;
    if (span.bold) node = <strong>{node}</strong>;
    if (span.italic) node = <em>{node}</em>;
    if (span.href)
      node = (
        <a href={span.href} rel="noopener noreferrer">
          {node}
        </a>
      );
    return <span key={index}>{node}</span>;
  });
}

export function RichArticleBody({
  blocks,
  fallback,
  media = [],
}: Readonly<{ blocks: unknown; fallback: string; media?: PublicMedia[] }>) {
  const parsed = richArticleBodySchema.safeParse(blocks);
  if (!parsed.success) {
    return (
      <div className="plain-text-content">
        {fallback.split(/\r?\n\s*\r?\n/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    );
  }
  return (
    <div className="rich-article-body">
      {parsed.data.map((block, index) => {
        if (block.type === 'paragraph') return <p key={index}>{spans(block.content)}</p>;
        if (block.type === 'heading')
          return block.level === 2 ? (
            <h2 key={index}>{spans(block.content)}</h2>
          ) : (
            <h3 key={index}>{spans(block.content)}</h3>
          );
        if (block.type === 'quote')
          return <blockquote key={index}>{spans(block.content)}</blockquote>;
        if (block.type === 'bulletList')
          return (
            <ul key={index}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        if (block.type === 'numberedList')
          return (
            <ol key={index}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          );
        if (block.type === 'divider') return <hr key={index} />;
        const image = media.find((item) => item.id === block.mediaId);
        return image ? (
          <figure key={index}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.altText}
              width={image.width}
              height={image.height}
              loading="lazy"
            />
            {image.caption || image.credit ? (
              <figcaption>
                {image.caption}
                {image.caption && image.credit ? ' · ' : ''}
                {image.credit}
              </figcaption>
            ) : null}
          </figure>
        ) : null;
      })}
    </div>
  );
}
