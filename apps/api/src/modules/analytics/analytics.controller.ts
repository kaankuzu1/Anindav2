import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(SupabaseAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboardStats(
    @Query('team_id') teamId: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    const range = startDate && endDate
      ? { start: new Date(startDate), end: new Date(endDate) }
      : undefined;
    return this.analyticsService.getDashboardStats(teamId, range);
  }

  @Get('emails')
  async getEmailStats(
    @Query('team_id') teamId: string,
    @Query('days') days?: string,
  ) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    return this.analyticsService.getEmailStats(teamId, days ? parseInt(days, 10) : 30);
  }

  @Get('campaigns')
  async getCampaignStats(
    @Query('team_id') teamId: string,
    @Query('campaign_id') campaignId?: string,
  ) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    return this.analyticsService.getCampaignStats(teamId, campaignId);
  }

  @Get('inboxes')
  async getInboxStats(@Query('team_id') teamId: string) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    return this.analyticsService.getInboxStats(teamId);
  }

  @Get('leads')
  async getLeadStats(@Query('team_id') teamId: string) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    return this.analyticsService.getLeadStats(teamId);
  }

  @Get('replies')
  async getReplyIntentBreakdown(
    @Query('team_id') teamId: string,
    @Query('days') days?: string,
  ) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    return this.analyticsService.getReplyIntentBreakdown(teamId, days ? parseInt(days, 10) : 30);
  }

  @Get('sequences/:campaign_id')
  async getSequencePerformance(
    @Query('team_id') teamId: string,
    @Param('campaign_id') campaignId: string,
  ) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    return this.analyticsService.getSequencePerformance(teamId, campaignId);
  }

  @Get('hourly')
  async getHourlyDistribution(
    @Query('team_id') teamId: string,
    @Query('days') days?: string,
  ) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    return this.analyticsService.getHourlyDistribution(teamId, days ? parseInt(days, 10) : 7);
  }
}
