import { Controller, Get, Inject, Param, Query, Res } from '@nestjs/common';

import {
  publicNewsDetailParametersSchema,
  publicNewsDetailQuerySchema,
  publicNewsQuerySchema,
  PublicNewsZodPipe,
} from './dto/public-news.dto.js';
import type {
  PublicNewsDetailParameters,
  PublicNewsDetailQuery,
  PublicNewsQuery,
} from './dto/public-news.dto.js';
import { PublicNewsService } from './public-news.service.js';

const PUBLIC_NEWS_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=60';
type HeaderResponse = { setHeader(name: string, value: string): void };

@Controller('public/news')
export class PublicNewsController {
  constructor(@Inject(PublicNewsService) private readonly news: PublicNewsService) {}

  @Get()
  async list(
    @Query(new PublicNewsZodPipe(publicNewsQuerySchema)) query: PublicNewsQuery,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const result = await this.news.list(query);
    response.setHeader('Cache-Control', PUBLIC_NEWS_CACHE_CONTROL);
    return result;
  }

  @Get(':slug')
  async detail(
    @Param(new PublicNewsZodPipe(publicNewsDetailParametersSchema))
    parameters: PublicNewsDetailParameters,
    @Query(new PublicNewsZodPipe(publicNewsDetailQuerySchema)) query: PublicNewsDetailQuery,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const result = await this.news.detail(parameters.slug, query.lang);
    response.setHeader('Cache-Control', PUBLIC_NEWS_CACHE_CONTROL);
    return result;
  }
}
