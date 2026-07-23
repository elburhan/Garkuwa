import { describe, expect, it } from '@jest/globals';

import {
  generateStaffSessionToken,
  hashStaffSessionToken,
} from '../src/modules/auth/session-token.js';

describe('staff session tokens', () => {
  it('creates opaque random tokens and hashes them before persistence', () => {
    const first = generateStaffSessionToken();
    const second = generateStaffSessionToken();
    const hash = hashStaffSessionToken(first);

    expect(first).not.toBe(second);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(first);
  });
});
