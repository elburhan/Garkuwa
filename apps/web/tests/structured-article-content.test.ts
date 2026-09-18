import { describe, expect, it } from 'vitest';

import { buildStructuredArticleBody } from '../src/lib/structured-article-content';

describe('structured article content', () => {
  it('converts controlled headings, emphasis, lists, quotes, links, images and dividers', () => {
    const blocks = buildStructuredArticleBody(
      '## Babban sashe\n\nRubutu mai **ƙarfi** da _lanƙwasa_ da [mahaɗi](https://example.test).\n\n- ɗaya\n- biyu\n\n> Zance\n\n[image:52fc7e20-ab06-4f7c-8d3c-15f075275fd3]\n\n---',
    );
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'quote',
      'image',
      'divider',
    ]);
    expect(blocks[1]).toMatchObject({ type: 'paragraph' });
  });

  it('preserves legacy plain paragraphs as safe structured paragraphs', () => {
    expect(buildStructuredArticleBody('Na farko.\n\nNa biyu.')).toHaveLength(2);
  });
});
