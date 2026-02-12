import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';
import { CampaignsService } from './campaigns.service';
import { ABTestService } from './ab-test.service';
import { CampaignTestService } from './campaign-test.service';

@Controller('campaigns')
@UseGuards(SupabaseAuthGuard)
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly abTestService: ABTestService,
    private readonly campaignTestService: CampaignTestService,
  ) {}

  @Get()
  async getCampaigns(@Query('team_id') teamId: string) {
    return this.campaignsService.getCampaigns(teamId);
  }

  @Get(':id')
  async getCampaign(
    @Param('id') campaignId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.campaignsService.getCampaign(campaignId, teamId);
  }

  @Post()
  async createCampaign(
    @Query('team_id') teamId: string,
    @Body() body: any,
  ) {
    return this.campaignsService.createCampaign(teamId, body);
  }

  @Patch(':id')
  async updateCampaign(
    @Param('id') campaignId: string,
    @Query('team_id') teamId: string,
    @Body() body: any,
  ) {
    return this.campaignsService.updateCampaign(campaignId, teamId, body);
  }

  @Post(':id/start')
  async startCampaign(
    @Param('id') campaignId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.campaignsService.startCampaign(campaignId, teamId);
  }

  @Post(':id/pause')
  async pauseCampaign(
    @Param('id') campaignId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.campaignsService.pauseCampaign(campaignId, teamId);
  }

  @Delete(':id')
  async deleteCampaign(
    @Param('id') campaignId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.campaignsService.deleteCampaign(campaignId, teamId);
  }

  // Test Email endpoints
  @Post('preview-test')
  async previewTest(
    @Query('team_id') teamId: string,
    @Body() body: {
      subject: string;
      body: string;
      smartTemplateEnabled: boolean;
      smartTemplateTone?: string;
      smartTemplateLanguageMatch?: boolean;
      smartTemplateNotes?: string;
      smartTemplateToneEnabled?: boolean;
      testLead: {
        first_name?: string;
        last_name?: string;
        company?: string;
        title?: string;
        analysis_notes?: string;
        country?: string;
      };
      inboxId: string;
    },
  ) {
    return this.campaignTestService.previewTest({ ...body, teamId });
  }

  @Post('send-test')
  async sendTest(
    @Query('team_id') teamId: string,
    @Body() body: {
      subject: string;
      body: string;
      smartTemplateEnabled: boolean;
      smartTemplateTone?: string;
      smartTemplateLanguageMatch?: boolean;
      smartTemplateNotes?: string;
      smartTemplateToneEnabled?: boolean;
      testLead: {
        first_name?: string;
        last_name?: string;
        company?: string;
        title?: string;
        analysis_notes?: string;
        country?: string;
      };
      inboxId: string;
      recipientEmail: string;
    },
  ) {
    return this.campaignTestService.sendTest({ ...body, teamId });
  }

  // A/B Test endpoints
  @Get(':id/ab-test/:seqId/stats')
  async getVariantStats(
    @Param('id') campaignId: string,
    @Param('seqId') sequenceId: string,
  ) {
    return this.abTestService.getVariantStats(campaignId, sequenceId);
  }

  @Post(':id/ab-test/:seqId/winner')
  async setWinner(
    @Param('id') campaignId: string,
    @Param('seqId') sequenceId: string,
    @Body() body: { variantId: string },
    @Query('team_id') teamId: string,
  ) {
    return this.abTestService.setWinner(campaignId, sequenceId, body.variantId, teamId);
  }

  @Post(':id/ab-test/:seqId/reset')
  async resetTest(
    @Param('id') campaignId: string,
    @Param('seqId') sequenceId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.abTestService.resetTest(campaignId, sequenceId, teamId);
  }

  @Patch(':id/ab-test/:seqId/weights')
  async updateWeights(
    @Param('id') campaignId: string,
    @Param('seqId') sequenceId: string,
    @Body() body: { weights: { variantId: string; weight: number }[] },
    @Query('team_id') teamId: string,
  ) {
    return this.abTestService.updateWeights(campaignId, sequenceId, body.weights, teamId);
  }

  @Get(':id/ab-test/history')
  async getTestHistory(@Param('id') campaignId: string) {
    return this.abTestService.getTestHistory(campaignId);
  }
}
