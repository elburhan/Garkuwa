import { describe, expect, it } from 'vitest';

import { getMessages } from '../src/i18n';
import {
  createEmptyIncidentReportValues,
  createIncidentReportSchema,
} from '../src/lib/incident-report-schema';

const categoryId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';

function validValues() {
  return {
    ...createEmptyIncidentReportValues(),
    categoryId,
    description: 'A sufficiently detailed incident description.',
  };
}

function schema(locale: 'ha' | 'en' = 'ha') {
  return createIncidentReportSchema(locale, getMessages(locale).public.incidentReport.validation);
}

describe('incident report client validation', () => {
  it('trims outer description whitespace but preserves paragraphs and internal spaces', () => {
    const result = schema().parse({
      ...validValues(),
      description: '  First  paragraph.\n\nSecond paragraph.  ',
    });

    expect(result.description).toBe('First  paragraph.\n\nSecond paragraph.');
  });

  it('validates the description minimum and maximum after trimming', () => {
    expect(schema().safeParse({ ...validValues(), description: '  too short  ' }).success).toBe(
      false,
    );
    expect(schema().safeParse({ ...validValues(), description: 'x'.repeat(5001) }).success).toBe(
      false,
    );
    expect(schema().safeParse({ ...validValues(), description: 'x'.repeat(5000) }).success).toBe(
      true,
    );
  });

  it('omits blank optional fields and the whole contact object when contact is disabled', () => {
    const result = schema().parse({
      ...validValues(),
      locationDescription: '   ',
      name: 'Hidden name',
      phone: 'invalid hidden value',
    });

    expect(result).toEqual({
      categoryId,
      description: 'A sufficiently detailed incident description.',
      severity: 'MEDIUM',
      submissionLanguage: 'ha',
    });
    expect(result).not.toHaveProperty('contact');
  });

  it('requires consent, a reachable method, and a matching preferred method', () => {
    expect(
      schema().safeParse({
        ...validValues(),
        contactEnabled: true,
        phone: '+234 800 000 0000',
      }).success,
    ).toBe(false);
    expect(
      schema().safeParse({
        ...validValues(),
        contactEnabled: true,
        phone: '+234 800 000 0000',
        preferredContactMethod: 'EMAIL',
        consentToContact: true,
      }).success,
    ).toBe(false);

    const validContact = schema().parse({
      ...validValues(),
      contactEnabled: true,
      email: ' fake@example.test ',
      preferredContactMethod: 'EMAIL',
      consentToContact: true,
    });
    expect(validContact.contact).toEqual({
      email: 'fake@example.test',
      preferredContactMethod: 'EMAIL',
      consentToContact: true,
    });
  });

  it('requires coordinates as a pair and enforces their ranges', () => {
    expect(schema().safeParse({ ...validValues(), latitude: '9.1' }).success).toBe(false);
    expect(schema().safeParse({ ...validValues(), latitude: '91', longitude: '7.4' }).success).toBe(
      false,
    );
    expect(schema().parse({ ...validValues(), latitude: '9.1', longitude: '7.4' })).toMatchObject({
      latitude: 9.1,
      longitude: 7.4,
    });
  });

  it('sets submission language only from the route locale', () => {
    expect(schema('ha').parse(validValues()).submissionLanguage).toBe('ha');
    expect(schema('en').parse(validValues()).submissionLanguage).toBe('en');
  });
});
