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

import type { StaffAuthRequest } from '../auth/auth.types.js';
import { JsonContentTypeGuard } from '../auth/json-content-type.guard.js';
import { StaffAuthOriginGuard } from '../auth/staff-auth-origin.guard.js';
import { NewsroomCapabilities } from '../auth/newsroom-capabilities.decorator.js';
import { NewsroomCapabilitiesGuard } from '../auth/newsroom-capabilities.guard.js';
import { StaffSessionGuard } from '../auth/staff-session.guard.js';
import {
  createNewsArticleSchema,
  listNewsArticlesQuerySchema,
  newsArticleAssignmentSchema,
  newsArticleMetadataSchema,
  newsArticleMediaSchema,
  newsArticlePublishingMetadataSchema,
  newsArticleCorrectionSchema,
  contributorCreateSchema,
  tagCreateSchema,
  topicCreateSchema,
  catalogIdSchema,
  tagUpdateSchema,
  topicUpdateSchema,
  contributorUpdateSchema,
  newsArticleDecisionSchema,
  newsArticleIdSchema,
  NewsZodPipe,
  updateNewsArticleSchema,
} from './dto/news.dto.js';
import type {
  CreateNewsArticleDto,
  NewsArticleAssignmentDto,
  NewsArticleMetadataDto,
  NewsArticleMediaDto,
  NewsArticlePublishingMetadataDto,
  NewsArticleCorrectionDto,
  ContributorCreateDto,
  TagCreateDto,
  TopicCreateDto,
  TagUpdateDto,
  TopicUpdateDto,
  ContributorUpdateDto,
  ListNewsArticlesQuery,
  NewsArticleDecisionDto,
  NewsArticleId,
  UpdateNewsArticleDto,
} from './dto/news.dto.js';
import { NewsMutationRateLimitGuard } from './news-mutation-rate-limit.guard.js';
import { NewsService } from './news.service.js';

@Controller('admin/news')
@UseGuards(StaffSessionGuard, NewsroomCapabilitiesGuard)
@NewsroomCapabilities('NEWS_VIEW')
export class AdminNewsController {
  constructor(@Inject(NewsService) private readonly news: NewsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Query(new NewsZodPipe(listNewsArticlesQuerySchema)) query: ListNewsArticlesQuery,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.list(query, request.staffPrincipal!);
  }

  @Get('categories')
  @Header('Cache-Control', 'private, no-store')
  categories() {
    return this.news.categories();
  }

  @Get('dashboard')
  @Header('Cache-Control', 'private, no-store')
  dashboard(@Req() request: StaffAuthRequest) {
    return this.news.dashboard(request.staffPrincipal!);
  }

  @Get('eligible-assignees')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('NEWS_ASSIGN')
  eligibleAssignees() {
    return this.news.eligibleAssignees();
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('NEWS_CREATE')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  create(
    @Body(new NewsZodPipe(createNewsArticleSchema)) input: CreateNewsArticleDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.create(input, request.staffPrincipal!);
  }

  @Patch(':articleId')
  @Header('Cache-Control', 'private, no-store')
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

  @Patch(':articleId/assignment')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('NEWS_MANAGE_ASSIGNMENTS')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  assign(
    @Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId,
    @Body(new NewsZodPipe(newsArticleAssignmentSchema)) input: NewsArticleAssignmentDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.assign(parameters.articleId, input, request.staffPrincipal!);
  }

  @Patch(':articleId/metadata')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  updateMetadata(
    @Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId,
    @Body(new NewsZodPipe(newsArticleMetadataSchema)) input: NewsArticleMetadataDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.updateMetadata(parameters.articleId, input, request.staffPrincipal!);
  }

  @Get(':articleId/preview')
  @Header('Cache-Control', 'private, no-store')
  preview(
    @Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.detail(parameters.articleId, request.staffPrincipal!);
  }

  @Patch(':articleId/media')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('MEDIA_USE')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  updateMedia(
    @Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId,
    @Body(new NewsZodPipe(newsArticleMediaSchema)) input: NewsArticleMediaDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.updateMedia(parameters.articleId, input, request.staffPrincipal!);
  }

  @Patch(':articleId/publishing-metadata')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('NEWS_PUBLISH')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  updatePublishingMetadata(
    @Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId,
    @Body(new NewsZodPipe(newsArticlePublishingMetadataSchema))
    input: NewsArticlePublishingMetadataDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.updatePublishingMetadata(parameters.articleId, input, request.staffPrincipal!);
  }

  @Post(':articleId/corrections')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('NEWS_PUBLISH')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  addCorrection(
    @Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId,
    @Body(new NewsZodPipe(newsArticleCorrectionSchema)) input: NewsArticleCorrectionDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.addCorrection(parameters.articleId, input, request.staffPrincipal!);
  }

  @Post('contributors')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('NEWS_EDIT_ANY')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  createContributor(@Body(new NewsZodPipe(contributorCreateSchema)) input: ContributorCreateDto) {
    return this.news.createContributor(input);
  }

  @Post('tags')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('NEWS_EDIT_ANY')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  createTag(@Body(new NewsZodPipe(tagCreateSchema)) input: TagCreateDto) {
    return this.news.createTag(input);
  }

  @Post('topics')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('NEWS_EDIT_ANY')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  createTopic(@Body(new NewsZodPipe(topicCreateSchema)) input: TopicCreateDto) {
    return this.news.createTopic(input);
  }

  @Get('contributors')
  contributors() {
    return this.news.contributors();
  }

  @Get('tags')
  tags() {
    return this.news.tags();
  }

  @Get('topics')
  topics() {
    return this.news.topics();
  }

  @Get(':articleId')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId,
    @Req() request: StaffAuthRequest,
  ) {
    return this.news.detail(parameters.articleId, request.staffPrincipal!);
  }

  @Patch('contributors/:id')
  @NewsroomCapabilities('NEWS_EDIT_ANY')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  updateContributor(
    @Param(new NewsZodPipe(catalogIdSchema)) parameters: { id: string },
    @Body(new NewsZodPipe(contributorUpdateSchema)) input: ContributorUpdateDto,
  ) {
    return this.news.updateContributor(parameters.id, input);
  }

  @Patch('tags/:id')
  @NewsroomCapabilities('NEWS_EDIT_ANY')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  updateTag(
    @Param(new NewsZodPipe(catalogIdSchema)) parameters: { id: string },
    @Body(new NewsZodPipe(tagUpdateSchema)) input: TagUpdateDto,
  ) {
    return this.news.updateTag(parameters.id, input);
  }

  @Patch('topics/:id')
  @NewsroomCapabilities('NEWS_EDIT_ANY')
  @UseGuards(StaffAuthOriginGuard, JsonContentTypeGuard, NewsMutationRateLimitGuard)
  updateTopic(
    @Param(new NewsZodPipe(catalogIdSchema)) parameters: { id: string },
    @Body(new NewsZodPipe(topicUpdateSchema)) input: TopicUpdateDto,
  ) {
    return this.news.updateTopic(parameters.id, input);
  }

  @Get(':articleId/history')
  @Header('Cache-Control', 'private, no-store')
  history(@Param(new NewsZodPipe(newsArticleIdSchema)) parameters: NewsArticleId) {
    return this.news.history(parameters.articleId);
  }
}
