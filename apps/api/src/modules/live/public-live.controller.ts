import { Controller, Get, Header, Inject, Param, Query } from '@nestjs/common';
import { z } from 'zod';

import { LiveZodPipe } from './dto/live.dto.js';
import { LiveService } from './live.service.js';

const publicListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(20),
    lang: z.enum(['ha', 'en']).default('ha'),
  })
  .strict();
const publicSlugSchema = z.object({ slug: z.string().trim().min(1).max(120) }).strict();
const publicDetailQuerySchema = z
  .object({
    lang: z.enum(['ha', 'en']).default('ha'),
    beforeSequence: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).default(20),
  })
  .strict();
const publicIncrementalQuerySchema = z
  .object({
    lang: z.enum(['ha', 'en']).default('ha'),
    afterSequence: z.coerce.number().int().nonnegative(),
    changedAfter: z.iso.datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().positive().max(50).default(20),
  })
  .strict();

@Controller('public/live')
export class PublicLiveController {
  constructor(@Inject(LiveService) private readonly live: LiveService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
  list(
    @Query(new LiveZodPipe(publicListQuerySchema)) query: z.infer<typeof publicListQuerySchema>,
  ) {
    return this.live.publicList(query);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60')
  detail(
    @Param(new LiveZodPipe(publicSlugSchema)) params: z.infer<typeof publicSlugSchema>,
    @Query(new LiveZodPipe(publicDetailQuerySchema)) query: z.infer<typeof publicDetailQuerySchema>,
  ) {
    return this.live.publicDetail(params.slug, query.lang, query.beforeSequence, query.limit);
  }

  @Get(':slug/updates')
  @Header('Cache-Control', 'public, max-age=5')
  updates(
    @Param(new LiveZodPipe(publicSlugSchema)) params: z.infer<typeof publicSlugSchema>,
    @Query(new LiveZodPipe(publicIncrementalQuerySchema))
    query: z.infer<typeof publicIncrementalQuerySchema>,
  ) {
    return this.live.publicUpdates(
      params.slug,
      query.lang,
      query.afterSequence,
      query.limit,
      query.changedAfter,
    );
  }
}
