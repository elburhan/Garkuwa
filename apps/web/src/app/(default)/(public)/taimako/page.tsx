import { HelpPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('ha', 'help');

export default function HausaHelpPage() {
  return <HelpPage locale="ha" />;
}
