import { ContactPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('ha', 'contact');

export default function HausaContactPage() {
  return <ContactPage locale="ha" />;
}
