import { getMessages, type Locale } from '@/i18n';

export function TrustNotice({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale);

  return (
    <aside className="trust-notice" aria-labelledby="trust-notice-title">
      <div className="content-width trust-notice-inner">
        <div className="notice-symbol" aria-hidden="true">
          i
        </div>
        <div>
          <h2 id="trust-notice-title">{messages.trust.title}</h2>
          <p>{messages.trust.body}</p>
        </div>
      </div>
    </aside>
  );
}
