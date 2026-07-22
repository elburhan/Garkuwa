import { AboutPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('en', 'about');

export default function EnglishAboutPage() {
  return <AboutPage locale="en" />;
}
