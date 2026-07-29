import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminNewsController } from './admin-news.controller.js';
import {
  NEWS_MUTATION_CLOCK,
  NewsMutationRateLimitGuard,
} from './news-mutation-rate-limit.guard.js';
import { NEWS_EDITORIAL_CLOCK, NewsService } from './news.service.js';
import { PublicNewsController } from './public/public-news.controller.js';
import { PUBLIC_NEWS_CLOCK, PublicNewsService } from './public/public-news.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminNewsController, PublicNewsController],
  providers: [
    NewsService,
    PublicNewsService,
    NewsMutationRateLimitGuard,
    { provide: NEWS_EDITORIAL_CLOCK, useValue: Date.now },
    { provide: NEWS_MUTATION_CLOCK, useValue: Date.now },
    { provide: PUBLIC_NEWS_CLOCK, useValue: Date.now },
  ],
})
export class NewsModule {}
