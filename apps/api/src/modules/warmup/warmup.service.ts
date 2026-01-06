import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

interface UpdateWarmupSettingsInput {
  enabled?: boolean;
  ramp_speed?: 'slow' | 'normal' | 'fast';
  target_daily_volume?: number;
  reply_rate_target?: number;
}

@Injectable()
export class WarmupService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async getWarmupState(inboxId: string, teamId: string) {
    // First verify inbox belongs to team
    const { data: inbox, error: inboxError } = await this.supabase
      .from('inboxes')
      .select('id, email, status')
      .eq('id', inboxId)
      .eq('team_id', teamId)
      .single();

    if (inboxError || !inbox) {
      throw new NotFoundException('Inbox not found');
    }

    const { data, error } = await this.supabase
      .from('warmup_state')
      .select('*')
      .eq('inbox_id', inboxId)
      .single();

    if (error) {
      // Create warmup state if it doesn't exist
      const { data: newState, error: createError } = await this.supabase
        .from('warmup_state')
        .insert({
          inbox_id: inboxId,
          enabled: false,
          phase: 'paused',
          current_day: 0,
          ramp_speed: 'normal',
          target_daily_volume: 50,
          reply_rate_target: 30,
        })
        .select()
        .single();

      if (createError) throw createError;
      return { ...newState, inbox };
    }

    return { ...data, inbox };
  }

  async getAllWarmupStates(teamId: string) {
    const { data, error } = await this.supabase
      .from('inboxes')
      .select(`
        id,
        email,
        provider,
        status,
        health_score,
        warmup_state(*)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async enableWarmup(inboxId: string, teamId: string) {
    const existingState = await this.getWarmupState(inboxId, teamId);

    // Preserve current_day when resuming from pause, only reset to 1 if fresh start (day 0)
    const currentDay = existingState?.current_day ?? 0;

    const { data, error } = await this.supabase
      .from('warmup_state')
      .update({
        enabled: true,
        phase: 'ramping',
        started_at: new Date().toISOString(),
        current_day: currentDay > 0 ? currentDay : 1,
      })
      .eq('inbox_id', inboxId)
      .select()
      .single();

    if (error) throw error;

    // Update inbox status
    await this.supabase
      .from('inboxes')
      .update({ status: 'warming_up' })
      .eq('id', inboxId);

    return data;
  }

  async disableWarmup(inboxId: string, teamId: string) {
    await this.getWarmupState(inboxId, teamId);

    const { data, error } = await this.supabase
      .from('warmup_state')
      .update({
        enabled: false,
        phase: 'paused',
      })
      .eq('inbox_id', inboxId)
      .select()
      .single();

    if (error) throw error;

    // Update inbox status back to active
    await this.supabase
      .from('inboxes')
      .update({ status: 'active' })
      .eq('id', inboxId);

    return data;
  }

  async updateWarmupSettings(inboxId: string, teamId: string, input: UpdateWarmupSettingsInput) {
    await this.getWarmupState(inboxId, teamId);

    const updateData: Record<string, unknown> = {};

    if (input.ramp_speed !== undefined) {
      updateData.ramp_speed = input.ramp_speed;
    }

    if (input.target_daily_volume !== undefined) {
      updateData.target_daily_volume = input.target_daily_volume;
    }

    if (input.reply_rate_target !== undefined) {
      updateData.reply_rate_target = input.reply_rate_target;
    }

    if (input.enabled !== undefined) {
      updateData.enabled = input.enabled;
      if (input.enabled) {
        updateData.phase = 'ramping';
        updateData.started_at = new Date().toISOString();
      } else {
        updateData.phase = 'paused';
      }
    }

    const { data, error } = await this.supabase
      .from('warmup_state')
      .update(updateData)
      .eq('inbox_id', inboxId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getWarmupStats(teamId: string) {
    // Get all warmup states for the team
    const { data: inboxes, error } = await this.supabase
      .from('inboxes')
      .select(`
        id,
        warmup_state(
          enabled,
          phase,
          current_day,
          sent_today,
          received_today,
          replied_today,
          sent_total,
          received_total,
          replied_total
        )
      `)
      .eq('team_id', teamId);

    if (error) throw error;

    // Calculate aggregates
    let totalSentToday = 0;
    let totalReceivedToday = 0;
    let totalRepliedToday = 0;
    let totalSent = 0;
    let totalReceived = 0;
    let totalReplied = 0;
    let activeWarmups = 0;
    let rampingInboxes = 0;
    let maintainingInboxes = 0;

    for (const inbox of inboxes ?? []) {
      const warmupState = inbox.warmup_state as any;
      if (warmupState) {
        if (warmupState.enabled) {
          activeWarmups++;
          if (warmupState.phase === 'ramping') rampingInboxes++;
          if (warmupState.phase === 'maintaining') maintainingInboxes++;
        }
        totalSentToday += warmupState.sent_today ?? 0;
        totalReceivedToday += warmupState.received_today ?? 0;
        totalRepliedToday += warmupState.replied_today ?? 0;
        totalSent += warmupState.sent_total ?? 0;
        totalReceived += warmupState.received_total ?? 0;
        totalReplied += warmupState.replied_total ?? 0;
      }
    }

    const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

    return {
      activeWarmups,
      rampingInboxes,
      maintainingInboxes,
      today: {
        sent: totalSentToday,
        received: totalReceivedToday,
        replied: totalRepliedToday,
      },
      total: {
        sent: totalSent,
        received: totalReceived,
        replied: totalReplied,
      },
      replyRate,
    };
  }

  async getWarmupHistory(inboxId: string, teamId: string, days = 30) {
    await this.getWarmupState(inboxId, teamId);

    // Get warmup interactions for history
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('warmup_interactions')
      .select('*')
      .eq('inbox_id', inboxId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by day
    const history: Record<string, { sent: number; received: number; replied: number }> = {};

    for (const interaction of data ?? []) {
      const date = new Date(interaction.created_at).toISOString().split('T')[0];
      if (!history[date]) {
        history[date] = { sent: 0, received: 0, replied: 0 };
      }
      if (interaction.type === 'sent') history[date].sent++;
      if (interaction.type === 'received') history[date].received++;
      if (interaction.type === 'replied') history[date].replied++;
    }

    return Object.entries(history).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }

  async resetWarmup(inboxId: string, teamId: string) {
    await this.getWarmupState(inboxId, teamId);

    const { data, error } = await this.supabase
      .from('warmup_state')
      .update({
        enabled: false,
        phase: 'paused',
        started_at: null,
        current_day: 0,
        sent_today: 0,
        received_today: 0,
        replied_today: 0,
        sent_total: 0,
        received_total: 0,
        replied_total: 0,
        last_activity_at: null,
      })
      .eq('inbox_id', inboxId)
      .select()
      .single();

    if (error) throw error;

    // Update inbox status
    await this.supabase
      .from('inboxes')
      .update({ status: 'active' })
      .eq('id', inboxId);

    return data;
  }
}
