import { IncidentStatus } from '../../../generated/prisma/enums.js';

export const incidentStatusTransitions = {
  [IncidentStatus.NEW]: [IncidentStatus.UNDER_REVIEW, IncidentStatus.REJECTED],
  [IncidentStatus.UNDER_REVIEW]: [
    IncidentStatus.ACTIONED,
    IncidentStatus.CLOSED,
    IncidentStatus.REJECTED,
  ],
  [IncidentStatus.ACTIONED]: [IncidentStatus.UNDER_REVIEW, IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [IncidentStatus.UNDER_REVIEW],
  [IncidentStatus.REJECTED]: [IncidentStatus.UNDER_REVIEW],
} as const satisfies Record<IncidentStatus, readonly IncidentStatus[]>;

export function isAllowedIncidentStatusTransition(
  fromStatus: IncidentStatus,
  toStatus: IncidentStatus,
): boolean {
  return (incidentStatusTransitions[fromStatus] as readonly IncidentStatus[]).includes(toStatus);
}

export function incidentStatusTransitionRequiresReason(
  fromStatus: IncidentStatus,
  toStatus: IncidentStatus,
): boolean {
  return (
    toStatus === IncidentStatus.REJECTED ||
    ((fromStatus === IncidentStatus.CLOSED || fromStatus === IncidentStatus.REJECTED) &&
      toStatus === IncidentStatus.UNDER_REVIEW)
  );
}
