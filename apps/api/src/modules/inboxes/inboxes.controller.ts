import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';
import { InboxesService } from './inboxes.service';

@Controller('inboxes')
@UseGuards(SupabaseAuthGuard)
export class InboxesController {
  constructor(private readonly inboxesService: InboxesService) {}

  @Get()
  async getInboxes(@Req() req: any, @Query('team_id') teamId: string) {
    return this.inboxesService.getInboxes(teamId);
  }

  @Get(':id')
  async getInbox(
    @Param('id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.inboxesService.getInbox(inboxId, teamId);
  }

  @Patch(':id')
  async updateInboxSettings(
    @Param('id') inboxId: string,
    @Query('team_id') teamId: string,
    @Body() body: any,
  ) {
    return this.inboxesService.updateInboxSettings(inboxId, teamId, body);
  }

  @Post(':id/pause')
  async pauseInbox(
    @Param('id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.inboxesService.pauseInbox(inboxId, teamId);
  }

  @Post(':id/resume')
  async resumeInbox(
    @Param('id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.inboxesService.resumeInbox(inboxId, teamId);
  }

  @Delete(':id')
  async deleteInbox(
    @Param('id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.inboxesService.deleteInbox(inboxId, teamId);
  }

  /**
   * Check DNS configuration for an inbox
   * GET /inboxes/:id/dns-check
   */
  @Get(':id/dns-check')
  async checkInboxDns(
    @Param('id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.inboxesService.checkInboxDns(inboxId, teamId);
  }

  /**
   * Check if an inbox's email account connection is still valid
   * POST /inboxes/:id/check-connection
   */
  @Post(':id/check-connection')
  async checkConnection(
    @Param('id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.inboxesService.checkConnection(inboxId, teamId);
  }
}
