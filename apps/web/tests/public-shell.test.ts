import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('public shell accessibility foundation', () => {
  it('provides the expected landmark and skip-link structure', () => {
    const shell = readSource('src/components/public/public-shell.tsx');
    const header = readSource('src/components/public/public-header.tsx');
    const footer = readSource('src/components/public/public-footer.tsx');

    expect(shell).toContain('className="skip-link"');
    expect(shell).toContain('href="#main-content"');
    expect(shell).toContain('<main id="main-content"');
    expect(header).toContain('<header');
    expect(footer).toContain('<footer');
  });

  it('exposes an accessible mobile menu state and control relationship', () => {
    const mobileNavigation = readSource('src/components/public/mobile-navigation.tsx');

    expect(mobileNavigation).toContain('aria-expanded={isOpen}');
    expect(mobileNavigation).toContain('aria-controls="mobile-navigation-panel"');
    expect(mobileNavigation).toContain('id="mobile-navigation-panel"');
  });
});
