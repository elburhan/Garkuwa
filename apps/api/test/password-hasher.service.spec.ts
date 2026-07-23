import { describe, expect, it } from '@jest/globals';

import { PasswordHasherService } from '../src/modules/auth/password-hasher.service.js';

describe('PasswordHasherService', () => {
  const service = new PasswordHasherService();
  const password = 'Fake-development-password-42!';

  it('creates salted Argon2id hashes and verifies only the valid password', async () => {
    const first = await service.hash(password);
    const second = await service.hash(password);

    expect(first).toMatch(/^\$argon2id\$/);
    expect(first).not.toBe(password);
    expect(second).not.toBe(first);
    await expect(service.verify(first, password)).resolves.toBe(true);
    await expect(service.verify(first, 'Wrong-development-password!')).resolves.toBe(false);
  });

  it('rejects a malformed stored hash safely', async () => {
    await expect(service.verify('not-a-valid-argon2-hash', password)).resolves.toBe(false);
  });
});
