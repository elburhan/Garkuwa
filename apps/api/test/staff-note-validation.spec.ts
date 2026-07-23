import { BadRequestException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import {
  createStaffNoteSchema,
  editStaffNoteSchema,
  redactStaffNoteSchema,
  StaffNoteZodPipe,
} from '../src/modules/incidents/staff-notes/dto/staff-note.dto.js';
import {
  STAFF_NOTE_MUTATION_LIMIT,
  STAFF_NOTE_MUTATION_WINDOW_MS,
  StaffNoteRateLimitGuard,
} from '../src/modules/incidents/staff-notes/staff-note-rate-limit.guard.js';

describe('staff-note DTO validation', () => {
  it('trims outer whitespace while preserving paragraphs and HTML-like plain text', () => {
    const pipe = new StaffNoteZodPipe(createStaffNoteSchema);
    expect(pipe.transform({ body: '  First.\n\n<script>literal()</script>  ' })).toEqual({
      body: 'First.\n\n<script>literal()</script>',
    });
  });

  it.each([
    {},
    { body: '' },
    { body: '   ' },
    { body: 'x'.repeat(5001) },
    { body: 'valid', unknown: true },
  ])('rejects invalid create input %#', (input) => {
    expect(() => new StaffNoteZodPipe(createStaffNoteSchema).transform(input)).toThrow(
      BadRequestException,
    );
  });

  it('enforces bounded administrative reasons and expected versions', () => {
    expect(() =>
      new StaffNoteZodPipe(editStaffNoteSchema).transform({
        body: 'Corrected',
        reason: 'short',
        expectedVersion: 1,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      new StaffNoteZodPipe(redactStaffNoteSchema).transform({
        reason: 'short',
        expectedVersion: 1,
      }),
    ).toThrow(BadRequestException);
  });
});

describe('staff-note mutation rate limit', () => {
  it('limits each actor independently and can be reset deterministically', () => {
    let now = 1_000;
    const guard = new StaffNoteRateLimitGuard(() => now);
    const contextFor = (id: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ staffPrincipal: { id } }),
        }),
      }) as unknown as ExecutionContext;

    for (let attempt = 0; attempt < STAFF_NOTE_MUTATION_LIMIT; attempt += 1) {
      expect(guard.canActivate(contextFor('actor-one'))).toBe(true);
    }
    expect(() => guard.canActivate(contextFor('actor-one'))).toThrow();
    expect(guard.canActivate(contextFor('actor-two'))).toBe(true);

    guard.reset();
    expect(guard.canActivate(contextFor('actor-one'))).toBe(true);
    now += STAFF_NOTE_MUTATION_WINDOW_MS;
    expect(guard.canActivate(contextFor('actor-one'))).toBe(true);
  });
});
