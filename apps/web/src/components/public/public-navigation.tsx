'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface PublicNavigationItem {
  href: string;
  label: string;
  isAction?: boolean;
}

export function PublicNavigation({
  items,
  label,
}: Readonly<{ items: readonly PublicNavigationItem[]; label: string }>) {
  const pathname = usePathname();

  return (
    <nav className="desktop-navigation" aria-label={label}>
      <ul className="navigation-list">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              className={item.isAction ? 'navigation-action' : undefined}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
