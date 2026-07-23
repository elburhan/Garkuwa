import { Readable } from 'node:stream';

import { NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import { AttachmentStatus, StaffRole } from '../src/generated/prisma/enums.js';
import { IncidentAttachmentsService } from '../src/modules/incidents/attachments/incident-attachments.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const attachmentId = 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0';
const actor = {
  id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
  email: 'moderator@example.test',
  name: 'Moderator',
  role: StaffRole.MODERATOR,
};

describe('IncidentAttachmentsService', () => {
  const findFirst = jest.fn<(input: unknown) => Promise<unknown>>();
  const createAudit = jest.fn<(input: unknown) => Promise<unknown>>();
  const getObject = jest.fn<(key: string) => Promise<unknown>>();
  const service = new IncidentAttachmentsService(
    {
      incidentAttachment: { findFirst },
      incidentAttachmentAccessHistory: { create: createAudit },
    } as unknown as PrismaService,
    { getObject, putObject: jest.fn(), deleteObject: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue({
      id: attachmentId,
      incidentId,
      objectKey: 'incidents/2026/07/private',
      originalFilename: 'evidence.pdf',
      verifiedMimeType: 'application/pdf',
      sizeBytes: 4,
      status: AttachmentStatus.AVAILABLE,
    });
    getObject.mockResolvedValue({
      stream: Readable.from(Buffer.from('test')),
      contentLength: 4,
      contentType: 'application/octet-stream',
    });
    createAudit.mockResolvedValue({ id: 'audit-id' });
  });

  it('initiates available content and records a payload-free access audit', async () => {
    await expect(service.content(incidentId, attachmentId, actor)).resolves.toMatchObject({
      contentLength: 4,
      contentType: 'application/pdf',
      filename: 'evidence.pdf',
    });
    expect(createAudit).toHaveBeenCalledWith({
      data: {
        attachmentId,
        incidentId,
        accessedByUserId: actor.id,
        accessType: 'CONTENT_ACCESS',
      },
      select: { id: true },
    });
    expect(JSON.stringify(createAudit.mock.calls[0]![0])).not.toMatch(
      /filename|objectKey|sha256|body|bytes/i,
    );
  });

  it.each([AttachmentStatus.QUARANTINED, AttachmentStatus.REJECTED])(
    'blocks %s content without storage or audit access',
    async (status) => {
      findFirst.mockResolvedValueOnce({
        id: attachmentId,
        incidentId,
        objectKey: 'private',
        originalFilename: 'evidence.pdf',
        verifiedMimeType: 'application/pdf',
        sizeBytes: 4,
        status,
      });
      await expect(service.content(incidentId, attachmentId, actor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(getObject).not.toHaveBeenCalled();
      expect(createAudit).not.toHaveBeenCalled();
    },
  );
});
