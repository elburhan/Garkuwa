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
import { StaffAuthOriginGuard } from '../auth/staff-auth-origin.guard.js';
import { NewsroomCapabilities } from '../auth/newsroom-capabilities.decorator.js';
import { NewsroomCapabilitiesGuard } from '../auth/newsroom-capabilities.guard.js';
import { StaffSessionGuard } from '../auth/staff-session.guard.js';
import {
  createLiveEventSchema,
  createLiveUpdateSchema,
  liveCorrectionRequestSchema,
  liveEventIdSchema,
  liveEventPublishingSchema,
  liveUpdateIdSchema,
  listLiveEventsQuerySchema,
  LiveZodPipe,
  livePinRequestSchema,
  liveWithdrawalRequestSchema,
  updateLiveEventMetadataSchema,
  type CreateLiveEventDto,
  type CreateLiveUpdateDto,
  type LiveEventId,
  type LiveEventPublishingDto,
  type LiveUpdateId,
  type ListLiveEventsQuery,
  type LiveCorrectionDto,
  type LivePinDto,
  type LiveWithdrawalDto,
  type UpdateLiveEventMetadataDto,
} from './dto/live.dto.js';
import { LiveService } from './live.service.js';

@Controller('admin/live')
@UseGuards(StaffSessionGuard, NewsroomCapabilitiesGuard)
@NewsroomCapabilities('NEWS_VIEW')
export class AdminLiveController {
  constructor(@Inject(LiveService) private readonly live: LiveService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query(new LiveZodPipe(listLiveEventsQuerySchema)) query: ListLiveEventsQuery) {
    return this.live.list(query);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('LIVE_CREATE')
  @UseGuards(StaffAuthOriginGuard)
  create(
    @Body(new LiveZodPipe(createLiveEventSchema)) body: CreateLiveEventDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.live.create(body, request.staffPrincipal!);
  }

  @Get(':eventId')
  @Header('Cache-Control', 'private, no-store')
  detail(@Param(new LiveZodPipe(liveEventIdSchema)) params: LiveEventId) {
    return this.live.detail(params.eventId);
  }

  @Patch(':eventId')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('LIVE_CREATE')
  @UseGuards(StaffAuthOriginGuard)
  updateMetadata(
    @Param(new LiveZodPipe(liveEventIdSchema)) params: LiveEventId,
    @Body(new LiveZodPipe(updateLiveEventMetadataSchema)) body: UpdateLiveEventMetadataDto,
  ) {
    return this.live.updateMetadata(params.eventId, body);
  }

  @Patch(':eventId/publishing')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('LIVE_PUBLISH')
  @UseGuards(StaffAuthOriginGuard)
  updatePublishing(
    @Param(new LiveZodPipe(liveEventIdSchema)) params: LiveEventId,
    @Body(new LiveZodPipe(liveEventPublishingSchema)) body: LiveEventPublishingDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.live.updatePublishing(params.eventId, body, request.staffPrincipal!);
  }

  @Post(':eventId/updates')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('LIVE_UPDATE')
  @UseGuards(StaffAuthOriginGuard)
  addUpdate(
    @Param(new LiveZodPipe(liveEventIdSchema)) params: LiveEventId,
    @Body(new LiveZodPipe(createLiveUpdateSchema)) body: CreateLiveUpdateDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.live.addUpdate(params.eventId, body, request.staffPrincipal!);
  }

  @Patch(':eventId/updates/:updateId/pin')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('LIVE_UPDATE')
  @UseGuards(StaffAuthOriginGuard)
  pinUpdate(
    @Param(new LiveZodPipe(liveUpdateIdSchema)) params: LiveUpdateId,
    @Body(new LiveZodPipe(livePinRequestSchema)) body: LivePinDto,
  ) {
    return this.live.pinUpdate(params.eventId, params.updateId, body);
  }

  @Patch(':eventId/updates/:updateId/correct')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('LIVE_UPDATE')
  @UseGuards(StaffAuthOriginGuard)
  correctUpdate(
    @Param(new LiveZodPipe(liveUpdateIdSchema)) params: LiveUpdateId,
    @Body(new LiveZodPipe(liveCorrectionRequestSchema)) body: LiveCorrectionDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.live.correctUpdate(params.eventId, params.updateId, body, request.staffPrincipal!);
  }

  @Patch(':eventId/updates/:updateId/withdraw')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('LIVE_UPDATE')
  @UseGuards(StaffAuthOriginGuard)
  withdrawUpdate(
    @Param(new LiveZodPipe(liveUpdateIdSchema)) params: LiveUpdateId,
    @Body(new LiveZodPipe(liveWithdrawalRequestSchema)) body: LiveWithdrawalDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.live.withdrawUpdate(params.eventId, params.updateId, body, request.staffPrincipal!);
  }
}
