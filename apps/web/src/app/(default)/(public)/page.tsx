import { PublicHome } from '@/components/public/public-home';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('ha', 'home');

export default function HausaHomePage() {
  return <PublicHome locale="ha" />;
}
