import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, SupabaseAuthGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
