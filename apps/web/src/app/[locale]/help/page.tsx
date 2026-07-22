import { HelpPage } from '@/components/public/informational-pages';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('en', 'help');

export default function EnglishHelpPage() {
  return <HelpPage locale="en" />;
}
