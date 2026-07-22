import { generateIncidentCaseId } from '../src/modules/incidents/incident-case-id.js';

describe('generateIncidentCaseId', () => {
  it('creates a non-sequential staff case identifier with the current year', () => {
    expect(generateIncidentCaseId(new Date('2026-07-22T00:00:00.000Z'))).toMatch(
      /^GAR-2026-[A-F0-9]{8}$/,
    );
  });

  it('uses cryptographic randomness for independent identifiers', () => {
    const identifiers = new Set(Array.from({ length: 50 }, () => generateIncidentCaseId()));

    expect(identifiers.size).toBe(50);
  });
});
