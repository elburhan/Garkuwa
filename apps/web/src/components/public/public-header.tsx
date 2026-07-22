import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';

import { LanguageSwitcher } from './language-switcher';
import { MobileNavigation } from './mobile-navigation';
import { PublicNavigation, type PublicNavigationItem } from './public-navigation';

export function PublicHeader({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale);
  const items: PublicNavigationItem[] = [
    { href: getPublicPath(locale, 'home'), label: messages.navigation.home },
    { href: getPublicPath(locale, 'faq'), label: messages.navigation.faq },
    { href: getPublicPath(locale, 'help'), label: messages.navigation.help },
    { href: getPublicPath(locale, 'about'), label: messages.navigation.about },
    { href: getPublicPath(locale, 'contact'), label: messages.navigation.contact },
    {
      href: getPublicPath(locale, 'reportIncident'),
      label: messages.navigation.reportIncident,
      isAction: true,
    },
  ];

  return (
    <header className="site-header">
      <div className="header-utility">
        <div className="content-width header-utility-inner">
          <p>{messages.featureStatus.notActive}</p>
          <LanguageSwitcher
            locale={locale}
            haLabel={messages.common.languageHausa}
            enLabel={messages.common.languageEnglish}
            navigationLabel={messages.accessibility.languageNavigation}
          />
        </div>
      </div>
      <div className="content-width header-main">
        <Link
          className="brand"
          href={getPublicPath(locale, 'home')}
          aria-label={messages.common.siteName}
        >
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span>
            <strong>{messages.common.siteName}</strong>
            <small>{messages.common.platformName}</small>
          </span>
        </Link>
        <PublicNavigation items={items} label={messages.navigation.label} />
        <MobileNavigation
          items={items}
          label={messages.navigation.label}
          openLabel={messages.navigation.openMenu}
          closeLabel={messages.navigation.closeMenu}
        />
      </div>
    </header>
  );
}
