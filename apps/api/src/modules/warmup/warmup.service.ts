import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { WarmupAssignmentService } from './warmup-assignment.service';

interface UpdateWarmupSettingsInput {
  enabled?: boolean;
  ramp_speed?: 'slow' | 'normal' | 'fast';
  target_daily_volume?: number;
  reply_rate_target?: number;
}

@Injectable()
export class WarmupService {
  private readonly logger = new Logger(WarmupService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly assignmentService: WarmupAssignmentService,
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
          warmup_mode: 'pool',
        })
        .select()
        .single();

      if (createError) throw createError;
      return { ...newState, inbox };
    }

    // Auto-heal any warmup state desync
    await this.reconcileWarmupState(inboxId, inbox.status, data.enabled);

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
        status_reason,
        health_score,
        warmup_state(*)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Batch reconciliation: scan all inboxes for warmup state desyncs and fix them
    for (const inbox of data ?? []) {
      const warmupState = inbox.warmup_state as any;
      if (!warmupState) continue;

      try {
        if (inbox.status === 'warming_up' && warmupState.enabled === false) {
          // Inbox thinks it's warming up but warmup is disabled — reset to active
          await this.supabase
            .from('inboxes')
            .update({ status: 'active' })
            .eq('id', inbox.id)
            .eq('status', 'warming_up');

          inbox.status = 'active';
          this.logger.warn(`Batch reconciled desync for inbox ${inbox.id}: status was 'warming_up' but warmup disabled — reset to 'active'`);
        } else if (inbox.status === 'active' && warmupState.enabled === true) {
          // Warmup is enabled but inbox doesn't reflect it — set to warming_up
          await this.supabase
            .from('inboxes')
            .update({ status: 'warming_up' })
            .eq('id', inbox.id)
            .eq('status', 'active');

          inbox.status = 'warming_up';
          this.logger.warn(`Batch reconciled desync for inbox ${inbox.id}: warmup enabled but status was 'active' — set to 'warming_up'`);
        }
      } catch (err) {
        this.logger.warn(`Failed to batch reconcile warmup state for inbox ${inbox.id}: ${err}`);
      }
    }

    return data;
  }

  async enableWarmup(inboxId: string, teamId: string, mode?: 'pool' | 'network') {
    const existingState = await this.getWarmupState(inboxId, teamId);

    // Pre-flight: cannot enable warmup on a disconnected inbox
    if (existingState.inbox?.status === 'error') {
      throw new BadRequestException('Cannot enable warmup for a disconnected inbox. Please reconnect it first.');
    }

    const warmupMode = mode ?? existingState.warmup_mode ?? 'pool';

    if (warmupMode === 'pool') {
      // Pool mode: require at least 2 inboxes
      const { data: teamInboxes, error: inboxError } = await this.supabase
        .from('inboxes')
        .select('id')
        .eq('team_id', teamId)
        .in('status', ['active', 'warming_up']);

      if (inboxError) throw inboxError;

      if (!teamInboxes || teamInboxes.length < 2) {
        throw new BadRequestException(
          'Pool warmup requires at least 2 inboxes in your team. Add another inbox or use Network mode for single-inbox warmup.'
        );
      }
    } else if (warmupMode === 'network') {
      // Network mode: assign an admin inbox
      await this.assignmentService.assignAdminInbox(inboxId);
    }

    // Preserve current_day when resuming from pause, only reset to 1 if fresh start (day 0)
    const currentDay = existingState?.current_day ?? 0;

    const { data, error } = await this.supabase
      .from('warmup_state')
      .update({
        enabled: true,
        phase: 'ramping',
        started_at: new Date().toISOString(),
        current_day: currentDay > 0 ? currentDay : 1,
        warmup_mode: warmupMode,
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
    const state = await this.getWarmupState(inboxId, teamId);

    // If network mode, release admin inbox assignment
    if (state.warmup_mode === 'network') {
      await this.assignmentService.releaseAdminInbox(inboxId);
    }

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
      .eq('id', inboxId)
      .eq('status', 'warming_up');

    // Cascade: check if remaining pool inboxes have < 2 peers
    try {
      await this.cascadePoolWarmupCheck(inboxId);
    } catch (err) {
      this.logger.warn(`Cascade pool warmup check failed after disabling ${inboxId}: ${err}`);
    }

    return data;
  }

  async switchWarmupMode(inboxId: string, teamId: string, newMode: 'pool' | 'network' | null) {
    const state = await this.getWarmupState(inboxId, teamId);

    if (state.warmup_mode === newMode) {
      return state;
    }

    // If warmup is enabled, disable it first (releases assignments if network)
    if (state.enabled) {
      await this.disableWarmup(inboxId, teamId);
    }

    // Update mode column
    const { data, error } = await this.supabase
      .from('warmup_state')
      .update({ warmup_mode: newMode })
      .eq('inbox_id', inboxId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getAssignments(inboxId: string, teamId: string) {
    // Verify inbox belongs to team
    await this.getWarmupState(inboxId, teamId);
    return this.assignmentService.getAssignedAdminInboxes(inboxId);
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

    // Sync inbox status when enabled/disabled via settings
    if (input.enabled === false) {
      await this.supabase
        .from('inboxes')
        .update({ status: 'active' })
        .eq('id', inboxId)
        .eq('status', 'warming_up');
    } else if (input.enabled === true) {
      await this.supabase
        .from('inboxes')
        .update({ status: 'warming_up' })
        .eq('id', inboxId)
        .eq('status', 'active');
    }

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
      .or(`from_inbox_id.eq.${inboxId},to_inbox_id.eq.${inboxId}`)
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
      if (interaction.interaction_type === 'sent' && interaction.from_inbox_id === inboxId) history[date].sent++;
      if (interaction.interaction_type === 'received' && interaction.to_inbox_id === inboxId) history[date].received++;
      if (interaction.interaction_type === 'replied') history[date].replied++;
    }

    return Object.entries(history).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }

  async resetWarmup(inboxId: string, teamId: string) {
    const state = await this.getWarmupState(inboxId, teamId);

    // Release admin inbox if network mode
    if (state.warmup_mode === 'network') {
      await this.assignmentService.releaseAdminInbox(inboxId);
    }

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

  /**
   * Auto-heal warmup state desync between inbox.status and warmup_state.enabled.
   * Called on every getWarmupState() read to ensure consistency.
   */
  private async reconcileWarmupState(inboxId: string, inboxStatus: string, warmupEnabled: boolean): Promise<void> {
    try {
      if (inboxStatus === 'warming_up' && !warmupEnabled) {
        // Inbox thinks it's warming up but warmup is disabled — reset to active
        await this.supabase
          .from('inboxes')
          .update({ status: 'active' })
          .eq('id', inboxId)
          .eq('status', 'warming_up');

        this.logger.warn(`Reconciled desync for inbox ${inboxId}: status was 'warming_up' but warmup disabled — reset to 'active'`);
      } else if (inboxStatus === 'active' && warmupEnabled) {
        // Warmup is enabled but inbox doesn't reflect it — set to warming_up
        await this.supabase
          .from('inboxes')
          .update({ status: 'warming_up' })
          .eq('id', inboxId)
          .eq('status', 'active');

        this.logger.warn(`Reconciled desync for inbox ${inboxId}: warmup enabled but status was 'active' — set to 'warming_up'`);
      }
    } catch (err) {
      this.logger.warn(`Failed to reconcile warmup state for inbox ${inboxId}: ${err}`);
    }
  }

  /**
   * After disabling warmup for an inbox, check if remaining pool inboxes in the team
   * have enough peers (< 2). If not, disable pool warmup for all remaining inboxes.
   */
  private async cascadePoolWarmupCheck(disabledInboxId: string): Promise<void> {
    const { data: inbox } = await this.supabase
      .from('inboxes')
      .select('team_id')
      .eq('id', disabledInboxId)
      .single();

    if (!inbox) return;

    const { data: poolStates } = await this.supabase
      .from('warmup_state')
      .select('inbox_id, warmup_mode, inbox:inboxes(id, status, team_id)')
      .eq('enabled', true);

    const teamPoolInboxes = (poolStates ?? []).filter((ws: any) => {
      const wsInbox = ws.inbox as any;
      return wsInbox?.team_id === inbox.team_id &&
        ws.warmup_mode !== 'network' &&
        (wsInbox.status === 'active' || wsInbox.status === 'warming_up');
    });

    if (teamPoolInboxes.length < 2) {
      for (const ws of teamPoolInboxes) {
        await this.supabase
          .from('warmup_state')
          .update({ enabled: false, phase: 'paused' })
          .eq('inbox_id', ws.inbox_id);

        await this.supabase
          .from('inboxes')
          .update({ status: 'active' })
          .eq('id', ws.inbox_id)
          .eq('status', 'warming_up');

        this.logger.log(`Cascade: Disabled pool warmup for ${ws.inbox_id} (insufficient pool peers)`);
      }
    }
  }
}
