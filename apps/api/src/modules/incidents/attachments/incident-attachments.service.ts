import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import { AttachmentAccessType, AttachmentStatus } from '../../../generated/prisma/enums.js';
import type { StaffPrincipal } from '../../auth/auth.types.js';
import { INCIDENT_OBJECT_STORAGE, type IncidentObjectStorage } from './incident-object-storage.js';

const metadataSelect = {
  id: true,
  originalFilename: true,
  verifiedMimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  pageCount: true,
  status: true,
  uploadedAt: true,
  availableAt: true,
} as const;

@Injectable()
export class IncidentAttachmentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(INCIDENT_OBJECT_STORAGE) private readonly storage: IncidentObjectStorage,
  ) {}

  async list(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true },
    });
    if (!incident) throw new NotFoundException('Incident not found.');
    const rows = await this.prisma.incidentAttachment.findMany({
      where: { incidentId },
      select: metadataSelect,
      orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
    });
    return {
      items: rows.map((row) => ({
        ...row,
        uploadedAt: row.uploadedAt.toISOString(),
        availableAt: row.availableAt?.toISOString() ?? null,
      })),
    };
  }

  async content(incidentId: string, attachmentId: string, actor: StaffPrincipal) {
    const attachment = await this.prisma.incidentAttachment.findFirst({
      where: { id: attachmentId, incidentId },
      select: {
        id: true,
        incidentId: true,
        objectKey: true,
        originalFilename: true,
        verifiedMimeType: true,
        sizeBytes: true,
        status: true,
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found.');
    if (attachment.status !== AttachmentStatus.AVAILABLE) {
      throw new NotFoundException('Attachment content is unavailable.');
    }
    const object = await this.storage.getObject(attachment.objectKey);
    if (object.contentLength !== attachment.sizeBytes) {
      throw new NotFoundException('Attachment content is unavailable.');
    }
    await this.prisma.incidentAttachmentAccessHistory.create({
      data: {
        attachmentId,
        incidentId,
        accessedByUserId: actor.id,
        accessType: AttachmentAccessType.CONTENT_ACCESS,
      },
      select: { id: true },
    });
    return {
      stream: object.stream,
      contentLength: attachment.sizeBytes,
      contentType: attachment.verifiedMimeType,
      filename: attachment.originalFilename,
    };
  }
}
