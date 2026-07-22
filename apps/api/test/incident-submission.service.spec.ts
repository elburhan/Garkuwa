import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import {
  IncidentSeverity,
  PreferredContactMethod,
  SubmissionLanguage,
} from '../src/generated/prisma/enums.js';
import type { CreateIncidentDto } from '../src/modules/incidents/dto/create-incident.dto.js';
import { IncidentSubmissionService } from '../src/modules/incidents/incident-submission.service.js';

const categoryId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const incidentId = '09980491-d3a6-4f0b-a2f4-e97458ee4973';
const baseSubmission: CreateIncidentDto = {
  categoryId,
  description: 'A sufficiently detailed incident description.',
  severity: IncidentSeverity.MEDIUM,
  submissionLanguage: SubmissionLanguage.ha,
};

interface TransactionMock {
  incidentCategory: { findFirst: jest.Mock<() => Promise<{ id: string } | null>> };
  incident: { create: jest.Mock<() => Promise<{ id: string }>> };
  incidentContact: { create: jest.Mock<() => Promise<{ id: string }>> };
  incidentStatusHistory: { create: jest.Mock<() => Promise<{ id: string }>> };
}

function createPrismaMock(): { prisma: PrismaService; transaction: TransactionMock } {
  const transaction: TransactionMock = {
    incidentCategory: {
      findFirst: jest
        .fn<() => Promise<{ id: string } | null>>()
        .mockResolvedValue({ id: categoryId }),
    },
    incident: {
      create: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: incidentId }),
    },
    incidentContact: {
      create: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'contact-id' }),
    },
    incidentStatusHistory: {
      create: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'history-id' }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (work: (value: TransactionMock) => Promise<void>) =>
      work(transaction),
    ),
  };

  return { prisma: prisma as unknown as PrismaService, transaction };
}

describe('IncidentSubmissionService', () => {
  it('creates an incident and initial history without a contact record', async () => {
    const { prisma, transaction } = createPrismaMock();
    const service = new IncidentSubmissionService(prisma, () => 'GAR-2026-AAAABBBB');

    const response = await service.submit(baseSubmission);

    expect(transaction.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          internalCaseId: 'GAR-2026-AAAABBBB',
          description: baseSubmission.description,
          status: 'NEW',
        }),
      }),
    );
    expect(transaction.incidentContact.create).not.toHaveBeenCalled();
    expect(transaction.incidentStatusHistory.create).toHaveBeenCalledWith({
      data: {
        incidentId,
        fromStatus: null,
        toStatus: 'NEW',
        changedByUserId: null,
      },
    });
    expect(response).toEqual(
      expect.objectContaining({ success: true, message: expect.any(String) }),
    );
    expect(response).not.toHaveProperty('id');
    expect(response).not.toHaveProperty('internalCaseId');
    expect(response).not.toHaveProperty('status');
  });

  it.each([
    [PreferredContactMethod.PHONE, { phone: '+234 800 000 0000' }],
    [PreferredContactMethod.EMAIL, { email: 'reporter@example.test' }],
  ])('creates a separate %s contact record', async (method, details) => {
    const { prisma, transaction } = createPrismaMock();
    const service = new IncidentSubmissionService(prisma, () => 'GAR-2026-AAAABBBB');

    await service.submit({
      ...baseSubmission,
      contact: {
        ...details,
        preferredContactMethod: method,
        consentToContact: true,
      },
    });

    expect(transaction.incidentContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incidentId,
        consentToContact: true,
        preferredContactMethod: method,
        ...details,
      }),
    });
  });

  it('rejects an inactive or missing category before creating an incident', async () => {
    const { prisma, transaction } = createPrismaMock();
    transaction.incidentCategory.findFirst.mockResolvedValue(null);
    const service = new IncidentSubmissionService(prisma, () => 'GAR-2026-AAAABBBB');

    await expect(service.submit(baseSubmission)).rejects.toThrow(BadRequestException);
    expect(transaction.incident.create).not.toHaveBeenCalled();
    expect(transaction.incidentStatusHistory.create).not.toHaveBeenCalled();
  });

  it('retries the complete transaction after a case-ID collision', async () => {
    const { prisma, transaction } = createPrismaMock();
    transaction.incident.create
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['internal_case_id'] } })
      .mockResolvedValueOnce({ id: incidentId });
    const generateCaseId = jest
      .fn<() => string>()
      .mockReturnValueOnce('GAR-2026-AAAAAAAA')
      .mockReturnValueOnce('GAR-2026-BBBBBBBB');
    const service = new IncidentSubmissionService(prisma, generateCaseId);

    await expect(service.submit(baseSubmission)).resolves.toMatchObject({ success: true });

    expect(generateCaseId).toHaveBeenCalledTimes(2);
    expect(transaction.incident.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ internalCaseId: 'GAR-2026-BBBBBBBB' }),
      }),
    );
    expect(transaction.incidentStatusHistory.create).toHaveBeenCalledTimes(1);
  });
});
