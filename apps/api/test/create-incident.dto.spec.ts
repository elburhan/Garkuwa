import { createIncidentSchema } from '../src/modules/incidents/dto/create-incident.dto.js';

const minimalSubmission = {
  categoryId: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
  description: 'A sufficiently detailed incident description.',
  severity: 'MEDIUM',
  submissionLanguage: 'ha',
};

const invalidSubmissions: Array<{ submission: Record<string, unknown>; reason: string }> = [
  {
    submission: { ...minimalSubmission, submissionLanguage: 'fr' },
    reason: 'unsupported language',
  },
  { submission: { ...minimalSubmission, severity: 'CRITICAL' }, reason: 'invalid severity' },
  { submission: { ...minimalSubmission, latitude: 10 }, reason: 'only one coordinate' },
  {
    submission: { ...minimalSubmission, latitude: 91, longitude: 8 },
    reason: 'invalid latitude',
  },
  {
    submission: { ...minimalSubmission, latitude: 10, longitude: -181 },
    reason: 'invalid longitude',
  },
];

describe('createIncidentSchema', () => {
  it('accepts a valid anonymous report without contact details', () => {
    expect(createIncidentSchema.safeParse(minimalSubmission).success).toBe(true);
  });

  it('trims outer description whitespace before validating and storing the value', () => {
    const result = createIncidentSchema.parse({
      ...minimalSubmission,
      description: '  A sufficiently detailed incident description.  ',
    });

    expect(result.description).toBe('A sufficiently detailed incident description.');
  });

  it('rejects a description that is empty after trimming', () => {
    expect(
      createIncidentSchema.safeParse({ ...minimalSubmission, description: '   \n\t  ' }).success,
    ).toBe(false);
  });

  it('preserves internal paragraphs and multiple spaces', () => {
    const description = 'First paragraph with details.\n\nSecond  paragraph with more details.';
    const result = createIncidentSchema.parse({ ...minimalSubmission, description });

    expect(result.description).toBe(description);
  });

  it.each(invalidSubmissions)('rejects $reason', ({ submission }) => {
    expect(createIncidentSchema.safeParse(submission).success).toBe(false);
  });

  it('rejects contact details without consent', () => {
    const result = createIncidentSchema.safeParse({
      ...minimalSubmission,
      contact: {
        phone: '+234 800 000 0000',
        preferredContactMethod: 'PHONE',
        consentToContact: false,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a preferred contact method without the matching field', () => {
    const result = createIncidentSchema.safeParse({
      ...minimalSubmission,
      contact: {
        email: 'reporter@example.test',
        preferredContactMethod: 'PHONE',
        consentToContact: true,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown request fields', () => {
    expect(
      createIncidentSchema.safeParse({ ...minimalSubmission, trackingRequested: true }).success,
    ).toBe(false);
  });
});
