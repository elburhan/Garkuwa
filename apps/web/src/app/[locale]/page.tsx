import { PublicHome } from '@/components/public/public-home';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('en', 'home');

export default function EnglishHomePage() {
  return <PublicHome locale="en" />;
}
