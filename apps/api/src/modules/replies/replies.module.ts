import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RepliesController } from './replies.controller';
import { RepliesService } from './replies.service';
import { ReplyTemplatesController } from './reply-templates.controller';
import { ReplyTemplatesService } from './reply-templates.service';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';

@Module({
  imports: [ConfigModule],
  controllers: [RepliesController, ReplyTemplatesController],
  providers: [RepliesService, ReplyTemplatesService, SupabaseAuthGuard],
  exports: [RepliesService, ReplyTemplatesService],
})
export class RepliesModule {}
