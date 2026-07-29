import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { InstitutionalPageKey } from '../../generated/prisma/enums.js';
import type { StaffAuthRequest } from '../auth/auth.types.js';
import { JsonContentTypeGuard } from '../auth/json-content-type.guard.js';
import { StaffAuthOriginGuard } from '../auth/staff-auth-origin.guard.js';
import { StaffRoles } from '../auth/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/staff-roles.guard.js';
import { StaffSessionGuard } from '../auth/staff-session.guard.js';
import {
  institutionalPageDecisionSchema,
  institutionalPageKeys,
  institutionalPageKeyParamSchema,
  InstitutionalContentZodPipe,
  publicInstitutionalPageQuerySchema,
  saveInstitutionalDraftSchema,
} from './dto/institutional-content.dto.js';
import type {
  InstitutionalPageDecisionDto,
  InstitutionalPageKeyParam,
  PublicInstitutionalPageQuery,
  SaveInstitutionalDraftDto,
} from './dto/institutional-content.dto.js';
import {
  institutionalPageEditorRoles,
  institutionalPageViewerRoles,
} from './institutional-content-policy.js';
import { InstitutionalContentRateLimitGuard } from './institutional-content-rate-limit.guard.js';
import { InstitutionalContentService } from './institutional-content.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@Controller('admin/institutional-pages')
@UseGuards(StaffSessionGuard, StaffRolesGuard)
@StaffRoles(...institutionalPageViewerRoles)
export class AdminInstitutionalContentController {
  constructor(
    @Inject(InstitutionalContentService)
    private readonly content: InstitutionalContentService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list() {
    return this.content.list();
  }

  @Get(':pageKey')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param(new InstitutionalContentZodPipe(institutionalPageKeyParamSchema))
    parameters: InstitutionalPageKeyParam,
    @Req() request: StaffAuthRequest,
  ) {
    return this.content.detail(parameters.pageKey as InstitutionalPageKey, request.staffPrincipal!);
  }

  @Patch(':pageKey/draft')
  @Header('Cache-Control', 'private, no-store')
  @StaffRoles(...institutionalPageEditorRoles)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, InstitutionalContentRateLimitGuard)
  saveDraft(
    @Param(new InstitutionalContentZodPipe(institutionalPageKeyParamSchema))
    parameters: InstitutionalPageKeyParam,
    @Body(new InstitutionalContentZodPipe(saveInstitutionalDraftSchema))
    input: SaveInstitutionalDraftDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.content.saveDraft(
      parameters.pageKey as InstitutionalPageKey,
      input,
      request.staffPrincipal!,
    );
  }

  @Patch(':pageKey/status')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, InstitutionalContentRateLimitGuard)
  transition(
    @Param(new InstitutionalContentZodPipe(institutionalPageKeyParamSchema))
    parameters: InstitutionalPageKeyParam,
    @Body(new InstitutionalContentZodPipe(institutionalPageDecisionSchema))
    input: InstitutionalPageDecisionDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.content.transition(
      parameters.pageKey as InstitutionalPageKey,
      input,
      request.staffPrincipal!,
    );
  }

  @Get(':pageKey/revisions')
  @Header('Cache-Control', 'private, no-store')
  revisions(
    @Param(new InstitutionalContentZodPipe(institutionalPageKeyParamSchema))
    parameters: InstitutionalPageKeyParam,
  ) {
    return this.content.revisions(parameters.pageKey as InstitutionalPageKey);
  }

  @Get(':pageKey/history')
  @Header('Cache-Control', 'private, no-store')
  history(
    @Param(new InstitutionalContentZodPipe(institutionalPageKeyParamSchema))
    parameters: InstitutionalPageKeyParam,
  ) {
    return this.content.history(parameters.pageKey as InstitutionalPageKey);
  }
}

@Controller('public/institutional-pages')
export class PublicInstitutionalContentController {
  constructor(
    @Inject(InstitutionalContentService)
    private readonly content: InstitutionalContentService,
  ) {}

  @Get(':pageKey')
  async page(
    @Param('pageKey') pageKey: string,
    @Query(new InstitutionalContentZodPipe(publicInstitutionalPageQuerySchema))
    query: PublicInstitutionalPageQuery,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    if (!institutionalPageKeys.some((key) => key === pageKey)) {
      throw new NotFoundException('Institutional page not found.');
    }
    const result = await this.content.publicPage(pageKey as InstitutionalPageKey, query);
    response.setHeader(
      'Cache-Control',
      'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    );
    return result;
  }
}
