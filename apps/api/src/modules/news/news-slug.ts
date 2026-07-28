const MAX_SLUG_LENGTH = 80;
const hausaLatinMap: Record<string, string> = {
  Ɓ: 'b',
  ɓ: 'b',
  Ɗ: 'd',
  ɗ: 'd',
  Ƙ: 'k',
  ƙ: 'k',
  Ƴ: 'y',
  ƴ: 'y',
};

export function createNewsSlugBase(titleHa: string): string {
  const transliterated = [...titleHa]
    .map((character) => hausaLatinMap[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  return transliterated || 'labari';
}

export function newsSlugCandidate(base: string, collisionNumber: number): string {
  if (collisionNumber === 1) return base;
  const suffix = `-${collisionNumber}`;
  return `${base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/g, '')}${suffix}`;
}
