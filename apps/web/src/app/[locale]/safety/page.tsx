import { SafetyPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('en', 'safety');

export default function EnglishSafetyPage() {
  return <SafetyPage locale="en" />;
}
