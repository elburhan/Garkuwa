import { IncidentReportPage } from '@/components/public/incident-report-page';
import { createPublicMetadata } from '@/lib/public-metadata';

export const metadata = createPublicMetadata('ha', 'reportIncident');

export default function HausaIncidentReportPage() {
  return <IncidentReportPage locale="ha" />;
}
