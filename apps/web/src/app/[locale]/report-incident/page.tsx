import { IncidentReportPage } from '@/components/public/incident-report-page';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('en', 'reportIncident');

export default function EnglishIncidentReportPage() {
  return <IncidentReportPage locale="en" />;
}
