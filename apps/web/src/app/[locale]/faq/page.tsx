import { FaqPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('en', 'faq');

export default function EnglishFaqPage() {
  return <FaqPage locale="en" />;
}
