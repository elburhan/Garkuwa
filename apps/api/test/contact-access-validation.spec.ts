import { BadRequestException, HttpException } from '@nestjs/common';

import type { StaffAuthRequest } from '../src/modules/auth/auth.types.js';
import {
  CONTACT_ACCESS_RATE_LIMIT,
  CONTACT_ACCESS_RATE_WINDOW_MS,
  ContactAccessRateLimitGuard,
} from '../src/modules/incidents/contact-access/contact-access-rate-limit.guard.js';
import { ContactAccessZodPipe } from '../src/modules/incidents/contact-access/dto/contact-access.dto.js';

describe('contact access validation and rate limiting', () => {
  const pipe = new ContactAccessZodPipe();

  it('trims only outer reason whitespace and preserves internal formatting', () => {
    expect(pipe.transform({ reason: '  Approved need.\n\nFollow-up required.  ' })).toEqual({
      reason: 'Approved need.\n\nFollow-up required.',
    });
  });

  it.each([
    {},
    { reason: 'short' },
    { reason: 'x'.repeat(1001) },
    { reason: 'Approved reason', unknown: true },
  ])('rejects invalid reason input %#', (input) => {
    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });

  it('limits independently by authenticated staff identity and resets deterministically', () => {
    let now = 1000;
    const guard = new ContactAccessRateLimitGuard(() => now);
    const request = {
      staffPrincipal: { id: 'actor-a' },
    } as unknown as StaffAuthRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };
    for (let attempt = 0; attempt < CONTACT_ACCESS_RATE_LIMIT; attempt += 1) {
      expect(guard.canActivate(context as never)).toBe(true);
    }
    expect(() => guard.canActivate(context as never)).toThrow(HttpException);

    request.staffPrincipal = {
      id: 'actor-b',
      email: 'actor-b@example.test',
      name: 'Actor B',
      role: 'ADMIN' as never,
    };
    expect(guard.canActivate(context as never)).toBe(true);

    guard.reset();
    request.staffPrincipal.id = 'actor-a';
    expect(guard.canActivate(context as never)).toBe(true);
    now += CONTACT_ACCESS_RATE_WINDOW_MS;
    expect(guard.canActivate(context as never)).toBe(true);
  });
});
