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
import { AuthGuard } from '@nestjs/passport';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
@UseGuards(AuthGuard('jwt'))
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

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
}
