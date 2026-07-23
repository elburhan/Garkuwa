import { IncidentStatus } from '../src/generated/prisma/enums.js';
import {
  incidentStatusTransitionRequiresReason,
  isAllowedIncidentStatusTransition,
} from '../src/modules/incidents/workflow/incident-status-transitions.js';
import { updateIncidentStatusSchema } from '../src/modules/incidents/workflow/dto/incident-workflow.dto.js';

const allowed = new Set([
  'NEW:UNDER_REVIEW',
  'NEW:REJECTED',
  'UNDER_REVIEW:ACTIONED',
  'UNDER_REVIEW:CLOSED',
  'UNDER_REVIEW:REJECTED',
  'ACTIONED:UNDER_REVIEW',
  'ACTIONED:CLOSED',
  'CLOSED:UNDER_REVIEW',
  'REJECTED:UNDER_REVIEW',
]);

describe('incident status transition graph', () => {
  it('exhaustively accepts only the approved directed transitions', () => {
    for (const fromStatus of Object.values(IncidentStatus)) {
      for (const toStatus of Object.values(IncidentStatus)) {
        expect(isAllowedIncidentStatusTransition(fromStatus, toStatus)).toBe(
          allowed.has(`${fromStatus}:${toStatus}`),
        );
      }
    }
  });

  it('requires reasons for rejection and reopening closed or rejected incidents', () => {
    expect(
      incidentStatusTransitionRequiresReason(IncidentStatus.NEW, IncidentStatus.REJECTED),
    ).toBe(true);
    expect(
      incidentStatusTransitionRequiresReason(IncidentStatus.CLOSED, IncidentStatus.UNDER_REVIEW),
    ).toBe(true);
    expect(
      incidentStatusTransitionRequiresReason(IncidentStatus.REJECTED, IncidentStatus.UNDER_REVIEW),
    ).toBe(true);
    expect(
      incidentStatusTransitionRequiresReason(IncidentStatus.ACTIONED, IncidentStatus.UNDER_REVIEW),
    ).toBe(false);
  });

  it('trims only outer reason whitespace and preserves internal formatting', () => {
    const parsed = updateIncidentStatusSchema.parse({
      toStatus: 'UNDER_REVIEW',
      reason: '  First paragraph.\n\nSecond  paragraph.  ',
      expectedUpdatedAt: '2026-07-23T12:00:00.000Z',
    });
    expect(parsed.reason).toBe('First paragraph.\n\nSecond  paragraph.');
  });
});
