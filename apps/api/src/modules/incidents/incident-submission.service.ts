import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { ContactDataCryptoService } from '../../common/security/contact-data-crypto.service.js';
import {
  IncidentStatus,
  PreferredContactMethod,
  SubmissionLanguage,
} from '../../generated/prisma/enums.js';
import type { CreateIncidentDto } from './dto/create-incident.dto.js';
import type { IncidentCaseIdGenerator } from './incident-case-id.js';

export const INCIDENT_CASE_ID_GENERATOR = Symbol('INCIDENT_CASE_ID_GENERATOR');

const MAX_CASE_ID_ATTEMPTS = 3;

export interface IncidentSubmissionResponse {
  success: true;
  message: string;
}

function dateOnly(value: string | undefined): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function timeOnly(value: string | undefined): Date | undefined {
  return value ? new Date(`1970-01-01T${value}:00.000Z`) : undefined;
}

function isCaseIdCollision(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002') {
    return false;
  }

  const metadata = 'meta' in error ? JSON.stringify(error.meta) : '';

  return metadata.includes('internal_case_id') || metadata.includes('internalCaseId');
}

@Injectable()
export class IncidentSubmissionService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(INCIDENT_CASE_ID_GENERATOR)
    private readonly generateCaseId: IncidentCaseIdGenerator,
    @Inject(ContactDataCryptoService)
    private readonly contactDataCrypto: ContactDataCryptoService,
  ) {}

  async submit(input: CreateIncidentDto): Promise<IncidentSubmissionResponse> {
    for (let attempt = 1; attempt <= MAX_CASE_ID_ATTEMPTS; attempt += 1) {
      try {
        await this.createSubmission(input, this.generateCaseId());

        return {
          success: true,
          message:
            input.submissionLanguage === SubmissionLanguage.ha
              ? 'An karɓi rahotonka. Za a duba shi ta hanyar tsarin cikin gida.'
              : 'Your report has been received for internal review.',
        };
      } catch (error) {
        if (isCaseIdCollision(error) && attempt < MAX_CASE_ID_ATTEMPTS) {
          continue;
        }

        if (isCaseIdCollision(error)) {
          throw new InternalServerErrorException('The submission could not be completed safely.');
        }

        if (error instanceof BadRequestException) {
          throw error;
        }

        throw new InternalServerErrorException('The submission could not be completed safely.');
      }
    }

    throw new InternalServerErrorException('The submission could not be completed safely.');
  }

  private async createSubmission(input: CreateIncidentDto, internalCaseId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const category = await transaction.incidentCategory.findFirst({
        where: { id: input.categoryId, isActive: true },
        select: { id: true },
      });

      if (!category) {
        throw new BadRequestException('The selected incident category is unavailable.');
      }

      const incident = await transaction.incident.create({
        data: {
          internalCaseId,
          categoryId: category.id,
          description: input.description,
          incidentDate: dateOnly(input.incidentDate),
          incidentTime: timeOnly(input.incidentTime),
          locationDescription: input.locationDescription,
          state: input.state,
          lga: input.lga,
          latitude: input.latitude,
          longitude: input.longitude,
          severity: input.severity,
          status: IncidentStatus.NEW,
          submissionLanguage: input.submissionLanguage,
        },
        select: { id: true },
      });

      if (input.contact) {
        await transaction.incidentContact.create({
          data: {
            incidentId: incident.id,
            name: this.encryptOptional(input.contact.name),
            phone: this.encryptOptional(input.contact.phone),
            email: this.encryptOptional(input.contact.email),
            preferredContactMethod:
              input.contact.preferredContactMethod === PreferredContactMethod.PHONE
                ? PreferredContactMethod.PHONE
                : PreferredContactMethod.EMAIL,
            safeContactInstructions: this.encryptOptional(input.contact.safeContactInstructions),
            consentToContact: true,
          },
        });
      }

      await transaction.incidentStatusHistory.create({
        data: {
          incidentId: incident.id,
          fromStatus: null,
          toStatus: IncidentStatus.NEW,
          changedByUserId: null,
        },
      });
    });
  }

  private encryptOptional(value: string | undefined): string | undefined {
    return value ? this.contactDataCrypto.encryptString(value) : undefined;
  }
}
