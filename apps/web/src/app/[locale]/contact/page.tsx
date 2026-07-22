import { ContactPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('en', 'contact');

export default function EnglishContactPage() {
  return <ContactPage locale="en" />;
}
