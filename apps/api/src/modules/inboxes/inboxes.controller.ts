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
import { AuthGuard } from '@nestjs/passport';
import { InboxesService } from './inboxes.service';

@Controller('inboxes')
@UseGuards(AuthGuard('jwt'))
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
}
