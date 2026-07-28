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

import { StaffRole } from '../../generated/prisma/enums.js';
import type { StaffAuthRequest } from '../auth/auth.types.js';
import { JsonContentTypeGuard } from '../auth/json-content-type.guard.js';
import { StaffAuthOriginGuard } from '../auth/staff-auth-origin.guard.js';
import { StaffRoles } from '../auth/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/staff-roles.guard.js';
import { StaffSessionGuard } from '../auth/staff-session.guard.js';
import {
  createNewsArticleSchema,
  listNewsArticlesQuerySchema,
  newsArticleDecisionSchema,
  newsArticleIdSchema,
  NewsZodPipe,
  updateNewsArticleSchema,
} from './dto/news.dto.js';
import type {
  CreateNewsArticleDto,
  ListNewsArticlesQuery,
  NewsArticleDecisionDto,
  NewsArticleId,
  UpdateNewsArticleDto,
} from './dto/news.dto.js';
import { newsCreatorRoles, newsViewerRoles } from './news-editorial-policy.js';
import { NewsMutationRateLimitGuard } from './news-mutation-rate-limit.guard.js';
import { NewsService } from './news.service.js';

@Controller('admin/news')
@UseGuards(StaffSessionGuard, StaffRolesGuard)
@StaffRoles(...newsViewerRoles)
export class AdminNewsController {
  constructor(@Inject(NewsService) private readonly news: NewsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query(new NewsZodPipe(listNewsArticlesQuerySchema)) query: ListNewsArticlesQuery) {
    return this.news.list(query);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @StaffRoles(...newsCreatorRoles)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  create(
    @Body(new NewsZodPipe(createNewsArticleSchema)) input: CreateNewsArticleDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.create(input, request.staffPrincipal!);
  }

  @Get(':articleId')
  @Header('Cache-Control', 'private, no-store')
  detail(@Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId) {
    return this.news.detail(parameters.articleId);
  }

  @Patch(':articleId')
  @Header('Cache-Control', 'private, no-store')
  @StaffRoles(StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.EDITOR)
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  update(
    @Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId,
    @Body(new NewsZodPipe(updateNewsArticleSchema)) input: UpdateNewsArticleDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.update(parameters.articleId, input, request.staffPrincipal!);
  }

  @Patch(':articleId/status')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  transition(
    @Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId,
    @Body(new NewsZodPipe(newsArticleDecisionSchema)) input: NewsArticleDecisionDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.transition(parameters.articleId, input, request.staffPrincipal!);
  }

  @Get(':articleId/history')
  @Header('Cache-Control', 'private, no-store')
  history(@Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId) {
    return this.news.history(parameters.articleId);
  }
}
