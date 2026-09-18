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
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import type { StaffAuthRequest } from '../auth/auth.types.js';
import { StaffAuthOriginGuard } from '../auth/staff-auth-origin.guard.js';
import { NewsroomCapabilities } from '../auth/newsroom-capabilities.decorator.js';
import { NewsroomCapabilitiesGuard } from '../auth/newsroom-capabilities.guard.js';
import { StaffSessionGuard } from '../auth/staff-session.guard.js';
import {
  MediaZodPipe,
  newsroomMediaArchiveSchema,
  newsroomMediaIdSchema,
  newsroomMediaListSchema,
  newsroomMediaUpdateSchema,
  newsroomMediaUploadSchema,
  type NewsroomMediaArchiveDto,
  type NewsroomMediaId,
  type NewsroomMediaListDto,
  type NewsroomMediaUpdateDto,
  type NewsroomMediaUploadDto,
} from './dto/newsroom-media.dto.js';
import { MAX_NEWSROOM_IMAGE_BYTES } from './newsroom-image-validation.js';
import { NewsroomMediaService } from './newsroom-media.service.js';

@Controller('admin/media')
@UseGuards(StaffSessionGuard, NewsroomCapabilitiesGuard)
@NewsroomCapabilities('MEDIA_USE')
export class AdminNewsroomMediaController {
  constructor(@Inject(NewsroomMediaService) private readonly media: NewsroomMediaService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query(new MediaZodPipe(newsroomMediaListSchema)) query: NewsroomMediaListDto) {
    return this.media.list(query);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('MEDIA_UPLOAD')
  @UseGuards(StaffAuthOriginGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_NEWSROOM_IMAGE_BYTES, files: 1, fields: 12 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new MediaZodPipe(newsroomMediaUploadSchema)) body: NewsroomMediaUploadDto,
    @Req() request: StaffAuthRequest,
  ) {
    return this.media.upload(file, body, request.staffPrincipal!);
  }

  @Get(':mediaId')
  @Header('Cache-Control', 'private, no-store')
  detail(@Param(new MediaZodPipe(newsroomMediaIdSchema)) params: NewsroomMediaId) {
    return this.media.detail(params.mediaId);
  }

  @Get(':mediaId/content')
  @Header('Cache-Control', 'private, no-store')
  async content(@Param(new MediaZodPipe(newsroomMediaIdSchema)) params: NewsroomMediaId) {
    const object = await this.media.content(params.mediaId, false);
    return new StreamableFile(object.stream, {
      type: object.contentType,
      length: object.contentLength,
      disposition: 'inline',
    });
  }

  @Patch(':mediaId')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('MEDIA_EDIT')
  @UseGuards(StaffAuthOriginGuard)
  update(
    @Param(new MediaZodPipe(newsroomMediaIdSchema)) params: NewsroomMediaId,
    @Body(new MediaZodPipe(newsroomMediaUpdateSchema)) body: NewsroomMediaUpdateDto,
  ) {
    return this.media.update(params.mediaId, body);
  }

  @Patch(':mediaId/archive')
  @Header('Cache-Control', 'private, no-store')
  @NewsroomCapabilities('MEDIA_ARCHIVE')
  @UseGuards(StaffAuthOriginGuard)
  archive(
    @Param(new MediaZodPipe(newsroomMediaIdSchema)) params: NewsroomMediaId,
    @Body(new MediaZodPipe(newsroomMediaArchiveSchema)) body: NewsroomMediaArchiveDto,
  ) {
    return this.media.archive(params.mediaId, body);
  }
}
