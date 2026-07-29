import {
  institutionalPageDecisionSchema,
  institutionalPageKeySchema,
  saveInstitutionalDraftSchema,
} from '../src/modules/institutional-content/dto/institutional-content.dto.js';

const validDraft = {
  titleHa: 'Taken shafin gwaji',
  summaryHa: 'Taƙaitaccen bayanin shafin.',
  titleEn: 'Test page title',
  summaryEn: 'A concise page summary.',
  sections: [
    {
      sectionKey: 'first-section',
      headingHa: 'Taken sashe',
      bodyHa: 'Wannan rubutu ne mai tsawon da ya dace domin gwajin sashe.',
      headingEn: 'Section heading',
      bodyEn: 'This section body is long enough for deterministic validation.',
    },
  ],
  expectedUpdatedAt: '2026-07-29T10:00:00.000Z',
};

describe('institutional content validation', () => {
  it('accepts only the five controlled page keys', () => {
    expect(
      ['ABOUT', 'FAQ', 'HELP', 'CONTACT', 'SAFETY_GUIDANCE'].every(
        (key) => institutionalPageKeySchema.safeParse(key).success,
      ),
    ).toBe(true);
    expect(institutionalPageKeySchema.safeParse('ARBITRARY_PAGE').success).toBe(false);
  });

  it('trims outer whitespace while preserving paragraphs', () => {
    const result = saveInstitutionalDraftSchema.parse({
      ...validDraft,
      sections: [
        {
          ...validDraft.sections[0],
          bodyHa: '  Sakin layi na farko mai cikakken bayani.\n\nSakin layi na biyu.  ',
        },
      ],
    });
    expect(result.sections[0]?.bodyHa).toBe(
      'Sakin layi na farko mai cikakken bayani.\n\nSakin layi na biyu.',
    );
  });

  it('rejects duplicate section keys and partial English content', () => {
    expect(
      saveInstitutionalDraftSchema.safeParse({
        ...validDraft,
        titleEn: null,
      }).success,
    ).toBe(false);
    expect(
      saveInstitutionalDraftSchema.safeParse({
        ...validDraft,
        sections: [validDraft.sections[0], validDraft.sections[0]],
      }).success,
    ).toBe(false);
  });

  it('requires a bounded correction reason and optimistic timestamp', () => {
    expect(
      institutionalPageDecisionSchema.safeParse({
        decision: 'RETURN_TO_DRAFT',
        expectedUpdatedAt: validDraft.expectedUpdatedAt,
      }).success,
    ).toBe(false);
    expect(
      institutionalPageDecisionSchema.safeParse({
        decision: 'RETURN_TO_DRAFT',
        reason: 'A clear correction reason.',
        expectedUpdatedAt: validDraft.expectedUpdatedAt,
      }).success,
    ).toBe(true);
    expect(
      saveInstitutionalDraftSchema.safeParse({
        ...validDraft,
        expectedUpdatedAt: undefined,
      }).success,
    ).toBe(false);
  });
});
