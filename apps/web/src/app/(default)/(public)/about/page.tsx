import { AboutPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('ha', 'about');

export default function HausaAboutPage() {
  return <AboutPage locale="ha" />;
}
