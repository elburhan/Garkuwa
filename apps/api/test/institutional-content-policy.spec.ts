import { InstitutionalPageWorkflowStatus, StaffRole } from '../src/generated/prisma/enums.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import { assertInstitutionalDecisionAllowed } from '../src/modules/institutional-content/institutional-content-policy.js';

function actor(role: StaffRole): StaffPrincipal {
  return { id: 'actor-id', email: 'staff@example.test', name: 'Test Staff', role };
}

describe('institutional content workflow policy', () => {
  it('allows editors to submit but not publish', () => {
    expect(
      assertInstitutionalDecisionAllowed(
        InstitutionalPageWorkflowStatus.DRAFT,
        'SUBMIT_FOR_REVIEW',
        actor(StaffRole.EDITOR),
      ),
    ).toBe(InstitutionalPageWorkflowStatus.IN_REVIEW);
    expect(() =>
      assertInstitutionalDecisionAllowed(
        InstitutionalPageWorkflowStatus.IN_REVIEW,
        'PUBLISH',
        actor(StaffRole.EDITOR),
      ),
    ).toThrow();
  });

  it('allows moderators to return review but not edit or publish', () => {
    expect(
      assertInstitutionalDecisionAllowed(
        InstitutionalPageWorkflowStatus.IN_REVIEW,
        'RETURN_TO_DRAFT',
        actor(StaffRole.MODERATOR),
      ),
    ).toBe(InstitutionalPageWorkflowStatus.DRAFT);
    expect(() =>
      assertInstitutionalDecisionAllowed(
        InstitutionalPageWorkflowStatus.IN_REVIEW,
        'PUBLISH',
        actor(StaffRole.MODERATOR),
      ),
    ).toThrow();
  });

  it.each([StaffRole.ADMIN, StaffRole.SUPER_ADMIN])(
    'allows %s to publish an in-review revision',
    (role) => {
      expect(
        assertInstitutionalDecisionAllowed(
          InstitutionalPageWorkflowStatus.IN_REVIEW,
          'PUBLISH',
          actor(role),
        ),
      ).toBe(InstitutionalPageWorkflowStatus.PUBLISHED);
    },
  );

  it('rejects every transition from the wrong current status', () => {
    expect(() =>
      assertInstitutionalDecisionAllowed(
        InstitutionalPageWorkflowStatus.PUBLISHED,
        'PUBLISH',
        actor(StaffRole.SUPER_ADMIN),
      ),
    ).toThrow();
  });
});
