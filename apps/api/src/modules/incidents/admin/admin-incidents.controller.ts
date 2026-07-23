import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { StaffRole } from '../../../generated/prisma/enums.js';
import { StaffRoles } from '../../auth/staff-roles.decorator.js';
import { StaffRolesGuard } from '../../auth/staff-roles.guard.js';
import { StaffSessionGuard } from '../../auth/staff-session.guard.js';
import { StaffAuthOriginGuard } from '../../auth/staff-auth-origin.guard.js';
import { JsonContentTypeGuard } from '../../auth/json-content-type.guard.js';
import type { StaffAuthRequest } from '../../auth/auth.types.js';
import { AdminIncidentsService } from './admin-incidents.service.js';
import {
  AdminIncidentsZodPipe,
  incidentIdParamSchema,
  listAdminIncidentsQuerySchema,
} from './dto/admin-incidents.dto.js';
import type { IncidentIdParam, ListAdminIncidentsQuery } from './dto/admin-incidents.dto.js';
import {
  updateIncidentAssignmentSchema,
  updateIncidentStatusSchema,
} from '../workflow/dto/incident-workflow.dto.js';
import type {
  UpdateIncidentAssignmentDto,
  UpdateIncidentStatusDto,
} from '../workflow/dto/incident-workflow.dto.js';
import { IncidentWorkflowService } from '../workflow/incident-workflow.service.js';
import {
  ContactAccessZodPipe,
  type ContactAccessRequestDto,
} from '../contact-access/dto/contact-access.dto.js';
import { ContactAccessRateLimitGuard } from '../contact-access/contact-access-rate-limit.guard.js';
import { IncidentContactAccessService } from '../contact-access/incident-contact-access.service.js';
import {
  createStaffNoteSchema,
  editStaffNoteSchema,
  listStaffNotesSchema,
  redactStaffNoteSchema,
  staffNoteParamsSchema,
  StaffNoteZodPipe,
  type CreateStaffNoteDto,
  type EditStaffNoteDto,
  type ListStaffNotesQuery,
  type RedactStaffNoteDto,
  type StaffNoteParams,
} from '../staff-notes/dto/staff-note.dto.js';
import { IncidentStaffNotesService } from '../staff-notes/incident-staff-notes.service.js';
import { StaffNoteRateLimitGuard } from '../staff-notes/staff-note-rate-limit.guard.js';

const incidentViewerRoles = [
  StaffRole.SUPER_ADMIN,
  StaffRole.ADMIN,
  StaffRole.MODERATOR,
  StaffRole.ANALYST,
] as const;

@Controller('admin/incidents')
@UseGuards(StaffSessionGuard, StaffRolesGuard)
@StaffRoles(...incidentViewerRoles)
export class AdminIncidentsController {
  constructor(
    @Inject(AdminIncidentsService) private readonly incidents: AdminIncidentsService,
    @Inject(IncidentWorkflowService) private readonly workflow: IncidentWorkflowService,
    @Inject(IncidentContactAccessService)
    private readonly contactAccess: IncidentContactAccessService,
    @Inject(IncidentStaffNotesService)
    private readonly staffNotes: IncidentStaffNotesService,
  ) {}

  @Get()
  list(
    @Query(new AdminIncidentsZodPipe(listAdminIncidentsQuerySchema))
    query: ListAdminIncidentsQuery,
  ) {
    return this.incidents.list(query);
  }

  @Get('eligible-assignees')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN)
  eligibleAssignees() {
    return this.workflow.eligibleAssignees();
  }

  @Get(':incidentId')
  detail(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema))
    parameters: IncidentIdParam,
  ) {
    return this.incidents.detail(parameters.incidentId);
  }

  @Patch(':incidentId/status')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard)
  updateStatus(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema)) parameters: IncidentIdParam,
    @Body(new AdminIncidentsZodPipe(updateIncidentStatusSchema)) input: UpdateIncidentStatusDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.workflow.updateStatus(parameters.incidentId, input, request.staffPrincipal!);
  }

  @Patch(':incidentId/assignment')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard)
  updateAssignment(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema)) parameters: IncidentIdParam,
    @Body(new AdminIncidentsZodPipe(updateIncidentAssignmentSchema))
    input: UpdateIncidentAssignmentDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.workflow.updateAssignment(parameters.incidentId, input, request.staffPrincipal!);
  }

  @Post(':incidentId/contact-access')
  @Header('Cache-Control', 'no-store')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, ContactAccessRateLimitGuard)
  revealContact(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema)) parameters: IncidentIdParam,
    @Body(new ContactAccessZodPipe()) input: ContactAccessRequestDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.contactAccess.reveal(parameters.incidentId, input, request.staffPrincipal!);
  }

  @Get(':incidentId/contact-access-history')
  @Header('Cache-Control', 'no-store')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN)
  contactAccessHistory(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema)) parameters: IncidentIdParam,
  ) {
    return this.contactAccess.history(parameters.incidentId);
  }

  @Get(':incidentId/notes')
  @Header('Cache-Control', 'no-store')
  listNotes(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema)) parameters: IncidentIdParam,
    @Query(new StaffNoteZodPipe(listStaffNotesSchema)) query: ListStaffNotesQuery,
  ) {
    return this.staffNotes.list(parameters.incidentId, query);
  }

  @Post(':incidentId/notes')
  @Header('Cache-Control', 'no-store')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, StaffNoteRateLimitGuard)
  createNote(
    @Param(new AdminIncidentsZodPipe(incidentIdParamSchema)) parameters: IncidentIdParam,
    @Body(new StaffNoteZodPipe(createStaffNoteSchema)) input: CreateStaffNoteDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.staffNotes.create(parameters.incidentId, input, request.staffPrincipal!);
  }

  @Patch(':incidentId/notes/:noteId')
  @Header('Cache-Control', 'no-store')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, StaffNoteRateLimitGuard)
  editNote(
    @Param(new StaffNoteZodPipe(staffNoteParamsSchema)) parameters: StaffNoteParams,
    @Body(new StaffNoteZodPipe(editStaffNoteSchema)) input: EditStaffNoteDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.staffNotes.edit(
      parameters.incidentId,
      parameters.noteId,
      input,
      request.staffPrincipal!,
    );
  }

  @Post(':incidentId/notes/:noteId/redact')
  @Header('Cache-Control', 'no-store')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, StaffNoteRateLimitGuard)
  redactNote(
    @Param(new StaffNoteZodPipe(staffNoteParamsSchema)) parameters: StaffNoteParams,
    @Body(new StaffNoteZodPipe(redactStaffNoteSchema)) input: RedactStaffNoteDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.staffNotes.redact(
      parameters.incidentId,
      parameters.noteId,
      input,
      request.staffPrincipal!,
    );
  }

  @Get(':incidentId/notes/:noteId/revisions')
  @Header('Cache-Control', 'no-store')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN)
  noteRevisions(@Param(new StaffNoteZodPipe(staffNoteParamsSchema)) parameters: StaffNoteParams) {
    return this.staffNotes.revisions(parameters.incidentId, parameters.noteId);
  }
}
