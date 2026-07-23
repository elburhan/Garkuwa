import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import { createIncidentSchema, ZodValidationPipe } from './dto/create-incident.dto.js';
import type { CreateIncidentDto } from './dto/create-incident.dto.js';
import { IncidentSubmissionService } from './incident-submission.service.js';
import type { IncidentSubmissionResponse } from './incident-submission.service.js';
import { PublicIncidentAbuseGuard } from './public-incident-abuse.guard.js';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_FILES,
  verifyAttachmentSet,
} from './attachments/attachment-file-validation.js';

@Controller('public/incidents')
export class PublicIncidentsController {
  constructor(
    @Inject(IncidentSubmissionService)
    private readonly incidentSubmissionService: IncidentSubmissionService,
    @Inject(PublicIncidentAbuseGuard)
    private readonly abuseGuard: PublicIncidentAbuseGuard,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PublicIncidentAbuseGuard)
  submit(
    @Body(new ZodValidationPipe(createIncidentSchema)) input: CreateIncidentDto,
  ): Promise<IncidentSubmissionResponse> {
    return this.incidentSubmissionService.submit(input);
  }

  @Post('with-attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PublicIncidentAbuseGuard)
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_ATTACHMENT_FILES, {
      limits: {
        fileSize: MAX_ATTACHMENT_BYTES,
        files: MAX_ATTACHMENT_FILES,
        fields: 1,
        parts: MAX_ATTACHMENT_FILES + 1,
      },
    }),
  )
  submitWithAttachments(
    @Body('report') report: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() request: { ip?: string; socket: { remoteAddress?: string } },
  ): Promise<IncidentSubmissionResponse> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(report);
    } catch {
      throw new BadRequestException('The multipart report JSON is invalid.');
    }
    const input = new ZodValidationPipe(createIncidentSchema).transform(parsed);
    this.abuseGuard.assertMultipartDuplicate(
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
      input,
    );
    return this.incidentSubmissionService.submitWithAttachments(input, verifyAttachmentSet(files));
  }
}
