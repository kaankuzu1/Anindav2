import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RepliesService } from './replies.service';

type IntentType = 'interested' | 'meeting_request' | 'question' | 'not_interested' | 'unsubscribe' | 'out_of_office' | 'auto_reply' | 'bounce' | 'neutral';

@Controller('replies')
@UseGuards(AuthGuard('jwt'))
export class RepliesController {
  constructor(private readonly repliesService: RepliesService) {}

  @Get()
  async getReplies(
    @Query('team_id') teamId: string,
    @Query('inbox_id') inboxId?: string,
    @Query('campaign_id') campaignId?: string,
    @Query('intent') intent?: IntentType,
    @Query('is_read') isRead?: string,
    @Query('is_archived') isArchived?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.repliesService.getReplies(teamId, {
      inbox_id: inboxId,
      campaign_id: campaignId,
      intent,
      is_read: isRead ? isRead === 'true' : undefined,
      is_archived: isArchived ? isArchived === 'true' : undefined,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Query('team_id') teamId: string) {
    return this.repliesService.getUnreadCount(teamId);
  }

  @Get('intent-summary')
  async getIntentSummary(@Query('team_id') teamId: string) {
    return this.repliesService.getIntentSummary(teamId);
  }

  @Get('thread/:thread_id')
  async getThread(
    @Param('thread_id') threadId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.repliesService.getThread(threadId, teamId);
  }

  @Get(':id')
  async getReply(
    @Param('id') replyId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.repliesService.getReply(replyId, teamId);
  }

  @Post(':id/read')
  async markAsRead(
    @Param('id') replyId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.repliesService.markAsRead(replyId, teamId);
  }

  @Post(':id/unread')
  async markAsUnread(
    @Param('id') replyId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.repliesService.markAsUnread(replyId, teamId);
  }

  @Post(':id/archive')
  async archive(
    @Param('id') replyId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.repliesService.archive(replyId, teamId);
  }

  @Post(':id/unarchive')
  async unarchive(
    @Param('id') replyId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.repliesService.unarchive(replyId, teamId);
  }

  @Patch(':id/intent')
  async updateIntent(
    @Param('id') replyId: string,
    @Query('team_id') teamId: string,
    @Body() body: { intent: IntentType },
  ) {
    return this.repliesService.updateIntent(replyId, teamId, body.intent);
  }

  @Post('bulk/read')
  async bulkMarkAsRead(
    @Query('team_id') teamId: string,
    @Body() body: { reply_ids: string[] },
  ) {
    return this.repliesService.bulkMarkAsRead(body.reply_ids, teamId);
  }

  @Post('bulk/archive')
  async bulkArchive(
    @Query('team_id') teamId: string,
    @Body() body: { reply_ids: string[] },
  ) {
    return this.repliesService.bulkArchive(body.reply_ids, teamId);
  }
}
