import Link from 'next/link';

import { getMessages, getPublicPath, type Locale } from '@/i18n';

import { LanguageSwitcher } from './language-switcher';

export function PublicFooter({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale);
  const year = new Date().getUTCFullYear();
  const links = [
    { href: getPublicPath(locale, 'home'), label: messages.navigation.home },
    { href: getPublicPath(locale, 'faq'), label: messages.navigation.faq },
    { href: getPublicPath(locale, 'help'), label: messages.navigation.help },
    { href: getPublicPath(locale, 'about'), label: messages.navigation.about },
    { href: getPublicPath(locale, 'contact'), label: messages.navigation.contact },
  ];

  return (
    <footer className="site-footer">
      <div className="content-width footer-grid">
        <div>
          <p className="footer-brand">{messages.common.siteName}</p>
          <p>{messages.footer.summary}</p>
        </div>
        <nav aria-label={messages.footer.navigationLabel}>
          <ul className="footer-links">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <LanguageSwitcher
            locale={locale}
            haLabel={messages.common.languageHausa}
            enLabel={messages.common.languageEnglish}
            navigationLabel={messages.footer.languagesLabel}
          />
        </div>
      </div>
      <div className="content-width emergency-notice">
        <strong>{messages.footer.emergencyTitle}</strong>
        <p>{messages.footer.emergencyText}</p>
      </div>
      <div className="footer-base">
        <div className="content-width">
          <p>
            © {year} {messages.footer.ownership}
          </p>
        </div>
      </div>
    </footer>
  );
}
