import { randomBytes } from 'node:crypto';

export type IncidentCaseIdGenerator = () => string;

export function generateIncidentCaseId(date: Date = new Date()): string {
  const suffix = randomBytes(4).toString('hex').toUpperCase();

  return `GAR-${date.getUTCFullYear()}-${suffix}`;
}
