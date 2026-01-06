import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboardStats(
    @Query('team_id') teamId: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
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
    return this.analyticsService.getEmailStats(teamId, days ? parseInt(days, 10) : 30);
  }

  @Get('campaigns')
  async getCampaignStats(
    @Query('team_id') teamId: string,
    @Query('campaign_id') campaignId?: string,
  ) {
    return this.analyticsService.getCampaignStats(teamId, campaignId);
  }

  @Get('inboxes')
  async getInboxStats(@Query('team_id') teamId: string) {
    return this.analyticsService.getInboxStats(teamId);
  }

  @Get('leads')
  async getLeadStats(@Query('team_id') teamId: string) {
    return this.analyticsService.getLeadStats(teamId);
  }

  @Get('replies')
  async getReplyIntentBreakdown(
    @Query('team_id') teamId: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getReplyIntentBreakdown(teamId, days ? parseInt(days, 10) : 30);
  }

  @Get('sequences/:campaign_id')
  async getSequencePerformance(
    @Query('team_id') teamId: string,
    @Query('campaign_id') campaignId: string,
  ) {
    return this.analyticsService.getSequencePerformance(teamId, campaignId);
  }

  @Get('hourly')
  async getHourlyDistribution(
    @Query('team_id') teamId: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getHourlyDistribution(teamId, days ? parseInt(days, 10) : 7);
  }
}
