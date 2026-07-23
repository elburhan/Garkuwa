import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { ContactDataCryptoService } from '../../../common/security/contact-data-crypto.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { StaffPrincipal } from '../../auth/auth.types.js';
import type { ContactAccessRequestDto } from './dto/contact-access.dto.js';

const contactSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  preferredContactMethod: true,
  safeContactInstructions: true,
  consentToContact: true,
} as const;

function noContact(): NotFoundException {
  return new NotFoundException('No contact information is available for this incident.');
}

@Injectable()
export class IncidentContactAccessService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ContactDataCryptoService) private readonly crypto: ContactDataCryptoService,
  ) {}

  async reveal(incidentId: string, input: ContactAccessRequestDto, actor: StaffPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      const incident = await transaction.incident.findUnique({
        where: { id: incidentId },
        select: { id: true, contact: { select: contactSelect } },
      });
      if (!incident?.contact) throw noContact();

      let contact: {
        name: string | null;
        phone: string | null;
        email: string | null;
        preferredContactMethod: typeof incident.contact.preferredContactMethod;
        safeContactInstructions: string | null;
        consentToContact: boolean;
      };
      try {
        contact = {
          name: incident.contact.name ? this.crypto.decryptString(incident.contact.name) : null,
          phone: incident.contact.phone ? this.crypto.decryptString(incident.contact.phone) : null,
          email: incident.contact.email ? this.crypto.decryptString(incident.contact.email) : null,
          preferredContactMethod: incident.contact.preferredContactMethod,
          safeContactInstructions: incident.contact.safeContactInstructions
            ? this.crypto.decryptString(incident.contact.safeContactInstructions)
            : null,
          consentToContact: incident.contact.consentToContact,
        };
      } catch {
        throw new InternalServerErrorException('Contact information could not be accessed.');
      }

      const access = await transaction.incidentContactAccessHistory.create({
        data: {
          incidentId,
          contactId: incident.contact.id,
          accessedByUserId: actor.id,
          reason: input.reason,
        },
        select: { createdAt: true },
      });
      return { contact, access: { accessedAt: access.createdAt.toISOString() } };
    });
  }

  async history(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        id: true,
        contactAccessHistory: {
          select: {
            id: true,
            reason: true,
            createdAt: true,
            accessedBy: { select: { id: true, displayName: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found.');
    return {
      items: incident.contactAccessHistory.map((entry) => ({
        id: entry.id,
        reason: entry.reason,
        accessedAt: entry.createdAt.toISOString(),
        accessedBy: entry.accessedBy,
      })),
    };
  }
}
