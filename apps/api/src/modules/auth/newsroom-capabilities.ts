import type { NewsroomCapability } from '@garkuwa/contracts';

import { StaffRole } from '../../generated/prisma/enums.js';

const allCapabilities = new Set<NewsroomCapability>([
  'NEWS_VIEW',
  'NEWS_CREATE',
  'NEWS_EDIT_OWN',
  'NEWS_EDIT_ANY',
  'NEWS_SUBMIT_REVIEW',
  'NEWS_REVIEW',
  'NEWS_RETURN_FOR_CHANGES',
  'NEWS_MARK_READY',
  'NEWS_PUBLISH',
  'NEWS_UNPUBLISH',
  'NEWS_ARCHIVE',
  'NEWS_ASSIGN',
  'NEWS_MANAGE_ASSIGNMENTS',
  'LIVE_CREATE',
  'LIVE_UPDATE',
  'LIVE_PUBLISH',
  'MEDIA_USE',
  'MEDIA_UPLOAD',
  'MEDIA_EDIT',
  'MEDIA_ARCHIVE',
  'MEDIA_MANAGE',
  'STAFF_MANAGE',
]);

export const newsroomCapabilitiesByRole: Readonly<
  Record<StaffRole, ReadonlySet<NewsroomCapability>>
> = {
  [StaffRole.SUPER_ADMIN]: allCapabilities,
  [StaffRole.ADMIN]: allCapabilities,
  [StaffRole.MODERATOR]: new Set([
    'NEWS_VIEW',
    'NEWS_REVIEW',
    'NEWS_RETURN_FOR_CHANGES',
    'NEWS_MARK_READY',
    'MEDIA_USE',
    'MEDIA_UPLOAD',
    'MEDIA_EDIT',
    'LIVE_UPDATE',
    'LIVE_PUBLISH',
  ]),
  [StaffRole.EDITOR]: new Set([
    'NEWS_VIEW',
    'NEWS_CREATE',
    'NEWS_EDIT_OWN',
    'NEWS_SUBMIT_REVIEW',
    'MEDIA_USE',
    'MEDIA_UPLOAD',
    'LIVE_CREATE',
    'LIVE_UPDATE',
  ]),
  [StaffRole.ANALYST]: new Set(),
};

export function hasNewsroomCapability(role: StaffRole, capability: NewsroomCapability): boolean {
  return newsroomCapabilitiesByRole[role].has(capability);
}
