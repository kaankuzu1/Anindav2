import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateWarmupQuota, calculateHealthScore, randomDelay } from '@aninda/shared';

interface WarmupSendJob {
  fromInboxId: string;
  toInboxId: string;
  isNetworkWarmup?: boolean;
}

// Work hours for spreading emails (9 AM - 6 PM = 9 hours)
const WORK_HOURS_MS = 9 * 60 * 60 * 1000;

interface WarmupInbox {
  id: string;
  team_id: string;
  email: string;
  health_score: number;
  status: string;
  bounce_rate_7d?: number;
  reply_rate_7d?: number;
}

interface WarmupState {
  inbox_id: string;
  enabled: boolean;
  phase: string;
  current_day: number;
  ramp_speed: 'slow' | 'normal' | 'fast';
  target_daily_volume: number;
  sent_today: number;
  received_today: number;
  replied_today: number;
  sent_total: number;
  received_total: number;
  replied_total: number;
  started_at: string | null;
  warmup_mode: string;
}

const LAST_RESET_KEY = 'warmup:last_reset_date';

export class WarmupScheduler {
  private warmupQueue: Queue<WarmupSendJob>;
  private intervalId: NodeJS.Timeout | null = null;
  private dailyResetIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.warmupQueue = new Queue<WarmupSendJob>('warmup-send', { connection: redis });
  }

  start() {
    console.log('Warmup scheduler started');

    // Run scheduler every 30 minutes (emails are spread across the day)
    this.scheduleWarmups();
    this.intervalId = setInterval(() => {
      this.scheduleWarmups();
    }, 30 * 60 * 1000); // 30 minutes

    // Check for daily reset every minute
    this.checkDailyReset();
    this.dailyResetIntervalId = setInterval(() => {
      this.checkDailyReset();
    }, 60 * 1000); // 1 minute
  }

  /**
   * Count pending jobs in queue for a specific inbox
   */
  private async getPendingJobCount(inboxId: string): Promise<number> {
    try {
      const [waiting, delayed, active] = await Promise.all([
        this.warmupQueue.getWaiting(),
        this.warmupQueue.getDelayed(),
        this.warmupQueue.getActive(),
      ]);

      const allJobs = [...waiting, ...delayed, ...active];
      return allJobs.filter(job => job.data.fromInboxId === inboxId).length;
    } catch (error) {
      console.error('Error counting pending jobs:', error);
      return 0;
    }
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.dailyResetIntervalId) {
      clearInterval(this.dailyResetIntervalId);
      this.dailyResetIntervalId = null;
    }
    await this.warmupQueue.close();
  }

  private async scheduleWarmups() {
    try {
      console.log('Scheduler: Checking for warmups to schedule...');

      // Get all enabled warmup inboxes with their states
      const { data: warmupStates, error: stateError } = await this.supabase
        .from('warmup_state')
        .select(`
          *,
          inbox:inboxes(id, team_id, email, health_score, status, bounce_rate_7d, reply_rate_7d)
        `)
        .eq('enabled', true);

      if (stateError) {
        console.error('Failed to fetch warmup states:', stateError);
        return;
      }

      if (!warmupStates || warmupStates.length === 0) {
        console.log('Scheduler: No active warmups found');
        return;
      }

      console.log(`Scheduler: Found ${warmupStates.length} active warmups`);

      // Group inboxes by team
      const teamInboxes = new Map<string, Array<{ inbox: WarmupInbox; state: WarmupState }>>();

      for (const ws of warmupStates) {
        const inbox = ws.inbox as WarmupInbox | null;
        if (!inbox) {
          console.log('Scheduler: Inbox is null for warmup state', ws.inbox_id);
          continue;
        }

        const teamId = inbox.team_id;
        if (!teamInboxes.has(teamId)) {
          teamInboxes.set(teamId, []);
        }
        teamInboxes.get(teamId)!.push({ inbox, state: ws });
      }

      console.log(`Scheduler: Grouped into ${teamInboxes.size} teams`);

      // Get today's date for job deduplication
      const today = new Date().toISOString().split('T')[0];

      // For each team, schedule warmups
      for (const [teamId, inboxStates] of teamInboxes) {
        // Separate pool and network inboxes, filter out disconnected ones
        const poolInboxes = inboxStates.filter(
          is => is.state.warmup_mode !== 'network' && (is.inbox.status === 'active' || is.inbox.status === 'warming_up')
        );
        const networkInboxes = inboxStates.filter(
          is => is.state.warmup_mode === 'network' && (is.inbox.status === 'active' || is.inbox.status === 'warming_up')
        );

        // Log disconnected inboxes
        const disconnectedInboxes = inboxStates.filter(
          is => is.inbox.status !== 'active' && is.inbox.status !== 'warming_up'
        );
        for (const { inbox } of disconnectedInboxes) {
          console.log(`Scheduler: Skipping disconnected inbox ${inbox.email} (status: ${inbox.status})`);
        }

        // --- Pool mode scheduling ---
        if (poolInboxes.length > 0) {
          if (poolInboxes.length < 2) {
            // Not enough connected pool inboxes - disable ALL pool warmup for this team
            console.log(`Scheduler: Team ${teamId} has only ${poolInboxes.length} connected pool inbox(es). Disabling pool warmup for all.`);

            for (const { inbox, state } of poolInboxes) {
              await this.disablePoolWarmup(inbox.id, inbox.email);
            }
            // Also disable any disconnected pool inboxes that still have warmup enabled
            for (const { inbox } of disconnectedInboxes.filter(is => is.state.warmup_mode !== 'network')) {
              await this.disablePoolWarmup(inbox.id, inbox.email);
            }
          } else {
            // Schedule pool warmup jobs
            await this.schedulePoolWarmups(teamId, poolInboxes, today);
          }
        }

        // --- Network mode scheduling ---
        for (const { inbox, state } of networkInboxes) {
          await this.scheduleNetworkWarmups(inbox, state, today);
        }
      }
    } catch (error) {
      console.error('Warmup scheduler error:', error);
    }
  }

  private async disablePoolWarmup(inboxId: string, email: string): Promise<void> {
    await this.supabase
      .from('warmup_state')
      .update({ enabled: false, phase: 'paused' })
      .eq('inbox_id', inboxId);

    console.log(`Scheduler: Disabled pool warmup for ${email} (insufficient connected pool inboxes)`);
  }

  private async schedulePoolWarmups(
    teamId: string,
    poolInboxes: Array<{ inbox: WarmupInbox; state: WarmupState }>,
    today: string,
  ) {
    console.log(`Scheduler: Team ${teamId} has ${poolInboxes.length} connected pool inboxes`);

    // Get all team inboxes as potential targets (both active and warming_up)
    const { data: allTeamInboxes, error: inboxError } = await this.supabase
      .from('inboxes')
      .select('id, email, status')
      .eq('team_id', teamId)
      .in('status', ['active', 'warming_up']);

    if (inboxError) {
      console.error('Failed to fetch team inboxes:', inboxError);
      return;
    }

    if (!allTeamInboxes || allTeamInboxes.length < 2) {
      console.log(`Scheduler: Team ${teamId} has less than 2 connected inboxes total`);
      return;
    }

    for (const { inbox, state } of poolInboxes) {
      await this.scheduleInboxJobs(inbox, state, allTeamInboxes, today, false);
    }
  }

  private async scheduleNetworkWarmups(
    inbox: WarmupInbox,
    state: WarmupState,
    today: string,
  ) {
    // Query assigned admin inboxes
    const { data: assignments, error } = await this.supabase
      .from('admin_inbox_assignments')
      .select('admin_inbox_id, admin_inboxes(id, email, status, health_score)')
      .eq('inbox_id', inbox.id);

    if (error) {
      console.error(`Failed to fetch admin inbox assignments for ${inbox.email}:`, error);
      return;
    }

    // Filter to active admin inboxes only
    const activeAdminInboxes = (assignments ?? [])
      .map((a: any) => a.admin_inboxes)
      .filter((ai: any) => ai && ai.status === 'active');

    if (activeAdminInboxes.length === 0) {
      console.log(`Scheduler: No active admin inboxes assigned to ${inbox.email}, skipping network warmup`);
      return;
    }

    // Calculate quota same as pool mode
    const quota = calculateWarmupQuota(state.current_day, state.ramp_speed);
    const pendingInQueue = await this.getPendingJobCount(inbox.id);
    const remaining = Math.max(0, quota - state.sent_today - pendingInQueue);

    console.log(`Scheduler: Network ${inbox.email} - Day ${state.current_day}, Quota: ${quota}, Sent: ${state.sent_today}, Pending: ${pendingInQueue}, Remaining: ${remaining}`);

    if (remaining <= 0) {
      console.log(`Scheduler: ${inbox.email} already met daily quota or has enough pending jobs`);
      return;
    }

    const intervalMs = Math.floor(WORK_HOURS_MS / Math.max(remaining, 1));

    for (let i = 0; i < remaining; i++) {
      // Alternate between user->admin and admin->user sends
      const adminInbox = activeAdminInboxes[i % activeAdminInboxes.length];
      const isUserSending = i % 2 === 0;

      const fromId = isUserSending ? inbox.id : `admin:${adminInbox.id}`;
      const toId = isUserSending ? `admin:${adminInbox.id}` : inbox.id;

      const baseDelay = i * intervalMs;
      const jitter = randomDelay(0, Math.min(intervalMs * 0.2, 60000));
      const delay = baseDelay + jitter;

      const jobId = `warmup-net-${inbox.id}-${today}-${i}`;

      try {
        await this.warmupQueue.add(
          'warmup-send',
          {
            fromInboxId: fromId,
            toInboxId: toId,
            isNetworkWarmup: true,
          },
          {
            delay,
            jobId,
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000,
            },
          }
        );

        console.log(`Scheduled network warmup: ${fromId} -> ${toId} (delay: ${Math.round(delay / 60000)}min, jobId: ${jobId})`);
      } catch (error: any) {
        if (error.message?.includes('Job already exists')) {
          // Skip silently
        } else {
          console.error(`Scheduler: Failed to add network job ${jobId}:`, error.message);
        }
      }
    }

    // Update health score
    const healthScore = calculateHealthScore({
      warmupEnabled: state.enabled,
      currentDay: state.current_day,
      sentTotal: state.sent_total,
      repliedTotal: state.replied_total,
      bounceRate: inbox.bounce_rate_7d ?? 0,
      spamRate: 0,
    });

    await this.supabase
      .from('inboxes')
      .update({ health_score: healthScore })
      .eq('id', inbox.id);
  }

  private async scheduleInboxJobs(
    inbox: WarmupInbox,
    state: WarmupState,
    allTeamInboxes: Array<{ id: string; email: string; status: string }>,
    today: string,
    isNetwork: boolean,
  ) {
    // Calculate quota for this inbox
    const quota = calculateWarmupQuota(state.current_day, state.ramp_speed);

    // Get pending jobs already in queue for this inbox
    const pendingInQueue = await this.getPendingJobCount(inbox.id);

    // Calculate remaining emails needed (quota - already sent - pending in queue)
    const remaining = Math.max(0, quota - state.sent_today - pendingInQueue);

    console.log(`Scheduler: ${inbox.email} - Day ${state.current_day}, Quota: ${quota}, Sent: ${state.sent_today}, Pending: ${pendingInQueue}, Remaining: ${remaining}`);

    if (remaining <= 0) {
      console.log(`Scheduler: ${inbox.email} already met daily quota or has enough pending jobs`);
      return;
    }

    // Calculate interval to spread emails across work hours
    const intervalMs = Math.floor(WORK_HOURS_MS / Math.max(remaining, 1));

    for (let i = 0; i < remaining; i++) {
      // Pick a random target inbox (not self)
      const targets = allTeamInboxes.filter(t => t.id !== inbox.id);
      if (targets.length === 0) {
        console.log(`Scheduler: No targets available for ${inbox.email}`);
        continue;
      }

      const targetInbox = targets[Math.floor(Math.random() * targets.length)];

      // Calculate delay to spread across work hours with some jitter
      const baseDelay = i * intervalMs;
      const jitter = randomDelay(0, Math.min(intervalMs * 0.2, 60000)); // Up to 20% jitter or 1 minute
      const delay = baseDelay + jitter;

      // Use unique job ID to prevent duplicates
      const jobId = `warmup-${inbox.id}-${today}-${i}`;

      try {
        await this.warmupQueue.add(
          'warmup-send',
          {
            fromInboxId: inbox.id,
            toInboxId: targetInbox.id,
          },
          {
            delay,
            jobId, // Unique ID prevents duplicate jobs
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000, // Start with 1 minute
            },
          }
        );

        console.log(`Scheduled warmup: ${inbox.email} -> ${targetInbox.email} (delay: ${Math.round(delay / 60000)}min, jobId: ${jobId})`);
      } catch (error: any) {
        // Job with this ID already exists - skip silently
        if (error.message?.includes('Job already exists')) {
          console.log(`Scheduler: Job ${jobId} already exists, skipping`);
        } else {
          console.error(`Scheduler: Failed to add job ${jobId}:`, error.message);
        }
      }
    }

    // Update health score including bounce/spam rates
    const healthScore = calculateHealthScore({
      warmupEnabled: state.enabled,
      currentDay: state.current_day,
      sentTotal: state.sent_total,
      repliedTotal: state.replied_total,
      bounceRate: inbox.bounce_rate_7d ?? 0,
      // Spam rate is approximated from lack of replies (very conservative estimate)
      spamRate: 0, // TODO: Track actual spam complaints when available
    });

    await this.supabase
      .from('inboxes')
      .update({ health_score: healthScore })
      .eq('id', inbox.id);
  }

  private async checkDailyReset() {
    // Get current date in UTC
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    try {
      // Check last reset date from Redis (persists across restarts)
      const lastResetDate = await this.redis.get(LAST_RESET_KEY);

      // If we've already reset today, skip
      if (lastResetDate === today) {
        return;
      }

      // Only reset if there was a previous reset (not first run)
      // This prevents incrementing day on every restart
      if (!lastResetDate) {
        // First run - just set the date without incrementing
        await this.redis.set(LAST_RESET_KEY, today);
        console.log(`Daily reset: First run, setting date to ${today}`);
        return;
      }

      // It's a new day - reset counters
      const { error } = await this.supabase
        .from('warmup_state')
        .update({
          sent_today: 0,
          received_today: 0,
          replied_today: 0,
        })
        .eq('enabled', true);

      if (error) {
        console.error('Failed to reset daily counters:', error);
        return;
      }

      // Increment current_day for all active warmups
      const { data: activeWarmups } = await this.supabase
        .from('warmup_state')
        .select('inbox_id, current_day')
        .eq('enabled', true);

      if (activeWarmups) {
        for (const ws of activeWarmups) {
          await this.supabase
            .from('warmup_state')
            .update({ current_day: ws.current_day + 1 })
            .eq('inbox_id', ws.inbox_id);
        }
      }

      // Reset admin inbox daily counters
      try {
        await this.supabase.rpc('reset_admin_inbox_daily_counters');
      } catch (rpcError) {
        console.warn('Failed to reset admin inbox daily counters (function may not exist yet):', rpcError);
      }

      // Store today's date in Redis
      await this.redis.set(LAST_RESET_KEY, today);
      console.log(`Daily warmup reset completed for ${today}`);
    } catch (error) {
      console.error('Daily reset error:', error);
    }
  }
}
