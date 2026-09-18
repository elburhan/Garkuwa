import type { RichArticleBody } from '@garkuwa/contracts/media';

function spans(value: string): Extract<RichArticleBody[number], { content: unknown }>['content'] {
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const parts = value.split(pattern).filter(Boolean);
  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return { text: part.slice(2, -2), bold: true };
    if (part.startsWith('_') && part.endsWith('_'))
      return { text: part.slice(1, -1), italic: true };
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    return link ? { text: link[1]!, href: link[2]! } : { text: part };
  });
}

export function buildStructuredArticleBody(value: string): RichArticleBody {
  const groups = value
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .filter(Boolean);
  return groups.map((group) => {
    const lines = group.split(/\r?\n/);
    if (group === '---') return { type: 'divider' as const };
    const image = /^\[image:([0-9a-f-]{36})\]$/i.exec(group);
    if (image) return { type: 'image' as const, mediaId: image[1]! };
    if (group.startsWith('### '))
      return { type: 'heading' as const, level: 3 as const, content: spans(group.slice(4)) };
    if (group.startsWith('## '))
      return { type: 'heading' as const, level: 2 as const, content: spans(group.slice(3)) };
    if (lines.every((line) => line.startsWith('- ')))
      return { type: 'bulletList' as const, items: lines.map((line) => line.slice(2)) };
    if (lines.every((line) => /^\d+\. /.test(line)))
      return {
        type: 'numberedList' as const,
        items: lines.map((line) => line.replace(/^\d+\. /, '')),
      };
    if (group.startsWith('> ')) return { type: 'quote' as const, content: spans(group.slice(2)) };
    return { type: 'paragraph' as const, content: spans(group) };
  });
}
