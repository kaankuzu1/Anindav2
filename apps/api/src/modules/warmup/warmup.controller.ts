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
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';
import { WarmupService } from './warmup.service';

@Controller('warmup')
@UseGuards(SupabaseAuthGuard)
export class WarmupController {
  constructor(private readonly warmupService: WarmupService) {}

  @Get()
  async getAllWarmupStates(@Query('team_id') teamId: string) {
    return this.warmupService.getAllWarmupStates(teamId);
  }

  @Get('stats')
  async getWarmupStats(@Query('team_id') teamId: string) {
    return this.warmupService.getWarmupStats(teamId);
  }

  @Get(':inbox_id')
  async getWarmupState(
    @Param('inbox_id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.warmupService.getWarmupState(inboxId, teamId);
  }

  @Get(':inbox_id/history')
  async getWarmupHistory(
    @Param('inbox_id') inboxId: string,
    @Query('team_id') teamId: string,
    @Query('days') days?: string,
  ) {
    return this.warmupService.getWarmupHistory(
      inboxId,
      teamId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get(':inbox_id/assignments')
  async getAssignments(
    @Param('inbox_id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.warmupService.getAssignments(inboxId, teamId);
  }

  @Post(':inbox_id/enable')
  async enableWarmup(
    @Param('inbox_id') inboxId: string,
    @Query('team_id') teamId: string,
    @Body() body: { mode?: 'pool' | 'network' },
  ) {
    return this.warmupService.enableWarmup(inboxId, teamId, body?.mode);
  }

  @Post(':inbox_id/disable')
  async disableWarmup(
    @Param('inbox_id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.warmupService.disableWarmup(inboxId, teamId);
  }

  @Patch(':inbox_id/mode')
  async switchMode(
    @Param('inbox_id') inboxId: string,
    @Query('team_id') teamId: string,
    @Body() body: { mode: 'pool' | 'network' | null },
  ) {
    return this.warmupService.switchWarmupMode(inboxId, teamId, body.mode);
  }

  @Patch(':inbox_id')
  async updateWarmupSettings(
    @Param('inbox_id') inboxId: string,
    @Query('team_id') teamId: string,
    @Body() body: {
      enabled?: boolean;
      ramp_speed?: 'slow' | 'normal' | 'fast';
      target_daily_volume?: number;
      reply_rate_target?: number;
    },
  ) {
    return this.warmupService.updateWarmupSettings(inboxId, teamId, body);
  }

  @Post(':inbox_id/reset')
  async resetWarmup(
    @Param('inbox_id') inboxId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.warmupService.resetWarmup(inboxId, teamId);
  }
}
