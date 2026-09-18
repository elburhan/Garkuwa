import { describe, expect, it } from '@jest/globals';

import { StaffRole } from '../src/generated/prisma/enums.js';
import { hasNewsroomCapability } from '../src/modules/auth/newsroom-capabilities.js';

describe('newsroom capability mapping', () => {
  it('keeps writers inside review workflow and separates publishing authority', () => {
    expect(hasNewsroomCapability(StaffRole.EDITOR, 'NEWS_CREATE')).toBe(true);
    expect(hasNewsroomCapability(StaffRole.EDITOR, 'NEWS_EDIT_OWN')).toBe(true);
    expect(hasNewsroomCapability(StaffRole.EDITOR, 'NEWS_PUBLISH')).toBe(false);
    expect(hasNewsroomCapability(StaffRole.MODERATOR, 'NEWS_MARK_READY')).toBe(true);
    expect(hasNewsroomCapability(StaffRole.MODERATOR, 'NEWS_PUBLISH')).toBe(false);
  });

  it('gives administrators operational newsroom capabilities without changing incident roles', () => {
    for (const role of [StaffRole.SUPER_ADMIN, StaffRole.ADMIN]) {
      expect(hasNewsroomCapability(role, 'NEWS_PUBLISH')).toBe(true);
      expect(hasNewsroomCapability(role, 'NEWS_MANAGE_ASSIGNMENTS')).toBe(true);
    }
    expect(StaffRole.MODERATOR).toBe('MODERATOR');
    expect(StaffRole.ANALYST).toBe('ANALYST');
  });

  it('keeps newsroom media permissions narrow by existing staff role', () => {
    expect(hasNewsroomCapability(StaffRole.EDITOR, 'MEDIA_UPLOAD')).toBe(true);
    expect(hasNewsroomCapability(StaffRole.EDITOR, 'MEDIA_EDIT')).toBe(false);
    expect(hasNewsroomCapability(StaffRole.MODERATOR, 'MEDIA_EDIT')).toBe(true);
    expect(hasNewsroomCapability(StaffRole.MODERATOR, 'MEDIA_ARCHIVE')).toBe(false);
    expect(hasNewsroomCapability(StaffRole.ADMIN, 'MEDIA_ARCHIVE')).toBe(true);
    expect(hasNewsroomCapability(StaffRole.ANALYST, 'MEDIA_USE')).toBe(false);
  });
});
