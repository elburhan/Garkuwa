'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import type { PublicNavigationItem } from './public-navigation';

export function MobileNavigation({
  items,
  label,
  openLabel,
  closeLabel,
}: Readonly<{
  items: readonly PublicNavigationItem[];
  label: string;
  openLabel: string;
  closeLabel: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="mobile-navigation">
      <button
        className="menu-button"
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true">{isOpen ? '×' : '☰'}</span>
        <span>{isOpen ? closeLabel : openLabel}</span>
      </button>
      {isOpen ? (
        <nav id="mobile-navigation-panel" className="mobile-navigation-panel" aria-label={label}>
          <ul className="mobile-navigation-list">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
