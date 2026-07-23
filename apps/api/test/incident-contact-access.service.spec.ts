import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { ContactDataCryptoService } from '../src/common/security/contact-data-crypto.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { StaffRole } from '../src/generated/prisma/enums.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import { IncidentContactAccessService } from '../src/modules/incidents/contact-access/incident-contact-access.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const contactId = 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0';
const actor: StaffPrincipal = {
  id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
  email: 'admin@example.test',
  name: 'Administrator',
  role: StaffRole.ADMIN,
};
const accessedAt = new Date('2026-07-23T14:00:00.000Z');

describe('IncidentContactAccessService', () => {
  const incidentFindUnique = jest.fn<(input: unknown) => Promise<unknown>>();
  const accessCreate = jest.fn<(input: unknown) => Promise<{ createdAt: Date }>>();
  const transactionClient = {
    incident: { findUnique: incidentFindUnique },
    incidentContactAccessHistory: { create: accessCreate },
  };
  const transaction = jest.fn(async (callback: (client: typeof transactionClient) => unknown) =>
    callback(transactionClient),
  );
  const prisma = {
    $transaction: transaction,
    incident: { findUnique: incidentFindUnique },
  } as unknown as PrismaService;
  const decryptString = jest.fn<(value: string) => string>((value) =>
    value.replace('encrypted:', ''),
  );
  const crypto = { decryptString } as unknown as ContactDataCryptoService;
  const service = new IncidentContactAccessService(prisma, crypto);

  beforeEach(() => {
    jest.clearAllMocks();
    incidentFindUnique.mockResolvedValue({
      id: incidentId,
      contact: {
        id: contactId,
        name: 'encrypted:Fake Person',
        phone: 'encrypted:+2340000000000',
        email: null,
        preferredContactMethod: 'PHONE',
        safeContactInstructions: 'encrypted:Weekdays only',
        consentToContact: true,
      },
    });
    accessCreate.mockResolvedValue({ createdAt: accessedAt });
  });

  it('decrypts only present values and audits the successful access exactly once', async () => {
    const result = await service.reveal(
      incidentId,
      { reason: 'Required for approved follow-up.' },
      actor,
    );
    expect(result).toEqual({
      contact: {
        name: 'Fake Person',
        phone: '+2340000000000',
        email: null,
        preferredContactMethod: 'PHONE',
        safeContactInstructions: 'Weekdays only',
        consentToContact: true,
      },
      access: { accessedAt: accessedAt.toISOString() },
    });
    expect(decryptString).toHaveBeenCalledTimes(3);
    expect(accessCreate).toHaveBeenCalledWith({
      data: {
        incidentId,
        contactId,
        accessedByUserId: actor.id,
        reason: 'Required for approved follow-up.',
      },
      select: { createdAt: true },
    });
    const auditCall = JSON.stringify(accessCreate.mock.calls[0]![0]);
    expect(auditCall).not.toMatch(/Fake Person|234000|Weekdays|encrypted:/);
    expect(JSON.stringify(incidentFindUnique.mock.calls[0]![0])).not.toContain('updatedAt');
  });

  it('returns a safe missing-contact error without decrypting or auditing', async () => {
    incidentFindUnique.mockResolvedValueOnce({ id: incidentId, contact: null });
    await expect(
      service.reveal(incidentId, { reason: 'Required for approved follow-up.' }, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(decryptString).not.toHaveBeenCalled();
    expect(accessCreate).not.toHaveBeenCalled();
  });

  it('turns malformed ciphertext into a safe error and creates no false audit entry', async () => {
    decryptString.mockImplementationOnce(() => {
      throw new Error('cryptography internals');
    });
    await expect(
      service.reveal(incidentId, { reason: 'Required for approved follow-up.' }, actor),
    ).rejects.toEqual(
      new InternalServerErrorException('Contact information could not be accessed.'),
    );
    expect(accessCreate).not.toHaveBeenCalled();
  });

  it('returns contact-free audit history through an explicit minimal selection', async () => {
    incidentFindUnique.mockResolvedValueOnce({
      id: incidentId,
      contactAccessHistory: [
        {
          id: contactId,
          reason: 'Required for approved follow-up.',
          createdAt: accessedAt,
          accessedBy: { id: actor.id, displayName: actor.name },
        },
      ],
    });
    const result = await service.history(incidentId);
    expect(result.items[0]).toEqual({
      id: contactId,
      reason: 'Required for approved follow-up.',
      accessedAt: accessedAt.toISOString(),
      accessedBy: { id: actor.id, displayName: actor.name },
    });
    const query = JSON.stringify(incidentFindUnique.mock.calls[0]![0]);
    expect(query).not.toMatch(/phone|email|safeContactInstructions|cipher|session|password/i);
    expect(query).not.toContain('"contact":');
  });
});
