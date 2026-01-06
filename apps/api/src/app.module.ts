import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { InboxesModule } from './modules/inboxes/inboxes.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { LeadsModule } from './modules/leads/leads.module';
import { WarmupModule } from './modules/warmup/warmup.module';
import { RepliesModule } from './modules/replies/replies.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { QueueModule } from './modules/queue/queue.module';
import { AIModule } from './modules/ai/ai.module';
import { DatabaseModule } from './shared/database/database.module';
import { RedisModule } from './shared/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    InboxesModule,
    CampaignsModule,
    LeadsModule,
    WarmupModule,
    RepliesModule,
    AnalyticsModule,
    WebhooksModule,
    QueueModule,
    AIModule,
  ],
})
export class AppModule {}
