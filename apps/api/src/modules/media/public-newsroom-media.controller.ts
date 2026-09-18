import { Controller, Get, Header, Inject, Param, StreamableFile } from '@nestjs/common';

import {
  MediaZodPipe,
  newsroomMediaIdSchema,
  type NewsroomMediaId,
} from './dto/newsroom-media.dto.js';
import { NewsroomMediaService } from './newsroom-media.service.js';

@Controller('public/news/media')
export class PublicNewsroomMediaController {
  constructor(@Inject(NewsroomMediaService) private readonly media: NewsroomMediaService) {}

  @Get(':mediaId')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  async content(@Param(new MediaZodPipe(newsroomMediaIdSchema)) params: NewsroomMediaId) {
    const object = await this.media.content(params.mediaId, true);
    return new StreamableFile(object.stream, {
      type: object.contentType,
      length: object.contentLength,
      disposition: 'inline',
    });
  }
}
