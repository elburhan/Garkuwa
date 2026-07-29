import { SafetyPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('ha', 'safety');

export default function HausaSafetyPage() {
  return <SafetyPage locale="ha" />;
}
