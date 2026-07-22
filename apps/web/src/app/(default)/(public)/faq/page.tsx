import { FaqPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('ha', 'faq');

export default function HausaFaqPage() {
  return <FaqPage locale="ha" />;
}
