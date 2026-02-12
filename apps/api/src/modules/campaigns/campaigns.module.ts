import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { ABTestService } from './ab-test.service';
import { CampaignTestService } from './campaign-test.service';
import { AIModule } from '../ai/ai.module';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';

@Module({
  imports: [AIModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, ABTestService, CampaignTestService, SupabaseAuthGuard],
  exports: [CampaignsService],
})
export class CampaignsModule {}
