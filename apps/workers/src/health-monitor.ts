import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateHealthScore } from '@aninda/shared';

const MIN_HEALTH_SCORE = 20; // Auto-pause if below this threshold
const HEALTH_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

// Gradual throttling levels based on health score
const THROTTLE_LEVELS: { minScore: number; maxScore: number; throttle: number }[] = [
  { minScore: 80, maxScore: 100, throttle: 100 }, // Full capacity
  { minScore: 60, maxScore: 79, throttle: 75 },   // 75% capacity
  { minScore: 40, maxScore: 59, throttle: 50 },   // 50% capacity
  { minScore: 20, maxScore: 39, throttle: 25 },   // 25% capacity
  { minScore: 0, maxScore: 19, throttle: 0 },     // Paused
];

/**
 * Calculate throttle percentage based on health score
 */
function calculateThrottleLevel(healthScore: number): number {
  for (const level of THROTTLE_LEVELS) {
    if (healthScore >= level.minScore && healthScore <= level.maxScore) {
      return level.throttle;
    }
  }
  return 0;
}

export class HealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {}

  start() {
    // Run immediately on start
    this.checkAllInboxes();

    // Then run every hour
    this.intervalId = setInterval(() => {
      this.checkAllInboxes();
    }, HEALTH_CHECK_INTERVAL);

    console.log('Health monitor started');
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkAllInboxes() {
    try {
      console.log('Running health check for all inboxes...');

      // Get all active inboxes with warmup state
      const { data: inboxes, error } = await this.supabase
        .from('inboxes')
        .select('*, warmup_state(*)')
        .in('status', ['active', 'warming_up']);

      if (error) {
        console.error('Failed to fetch inboxes for health check:', error);
        return;
      }

      if (!inboxes || inboxes.length === 0) {
        console.log('No active inboxes to check');
        return;
      }

      let checkedCount = 0;
      let pausedCount = 0;

      for (const inbox of inboxes) {
        try {
          const result = await this.checkInboxHealth(inbox);
          checkedCount++;
          if (result.paused) {
            pausedCount++;
          }
        } catch (err) {
          console.error(`Failed to check inbox ${inbox.id}:`, err);
        }
      }

      console.log(`Health check complete: ${checkedCount} checked, ${pausedCount} paused`);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  private async checkInboxHealth(inbox: any): Promise<{ paused: boolean }> {
    const warmupState = inbox.warmup_state?.[0] ?? inbox.warmup_state;

    // Get bounce and spam rates
    const rates = await this.getInboxRates(inbox.id);

    // Calculate health score
    const healthScore = calculateHealthScore({
      warmupEnabled: warmupState?.enabled ?? false,
      currentDay: warmupState?.current_day ?? 0,
      sentTotal: inbox.sent_total ?? 0,
      repliedTotal: warmupState?.replied_total ?? 0,
      bounceRate: rates.bounceRate,
      spamRate: rates.spamRate,
    });

    // Calculate throttle level based on health score
    const throttleLevel = calculateThrottleLevel(healthScore);
    const previousThrottle = inbox.throttle_percentage ?? 100;

    // Update inbox health score and throttle level
    await this.supabase
      .from('inboxes')
      .update({
        health_score: healthScore,
        throttle_percentage: throttleLevel,
        last_health_check: new Date().toISOString(),
      })
      .eq('id', inbox.id);

    // Log throttle changes
    if (throttleLevel !== previousThrottle) {
      console.log(`Inbox ${inbox.id}: Throttle adjusted from ${previousThrottle}% to ${throttleLevel}% (health: ${healthScore})`);

      await this.supabase
        .from('inbox_events')
        .insert({
          team_id: inbox.team_id,
          inbox_id: inbox.id,
          event_type: 'throttle_adjusted',
          metadata: {
            health_score: healthScore,
            previous_throttle: previousThrottle,
            new_throttle: throttleLevel,
            bounce_rate: rates.bounceRate,
            spam_rate: rates.spamRate,
          },
        });
    }

    // Auto-pause if health score is too low (throttle = 0)
    if (healthScore < MIN_HEALTH_SCORE && inbox.status !== 'paused') {
      console.log(`Inbox ${inbox.id} health score ${healthScore} below threshold ${MIN_HEALTH_SCORE}, pausing...`);

      await this.supabase
        .from('inboxes')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          pause_reason: `Low health score: ${healthScore}`,
        })
        .eq('id', inbox.id);

      // Log the pause event
      await this.supabase
        .from('inbox_events')
        .insert({
          team_id: inbox.team_id,
          inbox_id: inbox.id,
          event_type: 'auto_paused',
          metadata: {
            reason: 'low_health_score',
            health_score: healthScore,
            threshold: MIN_HEALTH_SCORE,
            bounce_rate: rates.bounceRate,
            spam_rate: rates.spamRate,
          },
        });

      return { paused: true };
    }

    // Check for high bounce rate separately (even if health score is ok)
    if (rates.bounceRate > 0.03 && inbox.status !== 'paused') {
      console.log(`Inbox ${inbox.id} bounce rate ${(rates.bounceRate * 100).toFixed(2)}% exceeds 3%, pausing...`);

      await this.supabase
        .from('inboxes')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          pause_reason: `High bounce rate: ${(rates.bounceRate * 100).toFixed(2)}%`,
        })
        .eq('id', inbox.id);

      await this.supabase
        .from('inbox_events')
        .insert({
          team_id: inbox.team_id,
          inbox_id: inbox.id,
          event_type: 'auto_paused',
          metadata: {
            reason: 'high_bounce_rate',
            bounce_rate: rates.bounceRate,
            threshold: 0.03,
          },
        });

      return { paused: true };
    }

    // Check for high spam rate
    if (rates.spamRate > 0.01 && inbox.status !== 'paused') {
      console.log(`Inbox ${inbox.id} spam rate ${(rates.spamRate * 100).toFixed(2)}% exceeds 1%, pausing...`);

      await this.supabase
        .from('inboxes')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          pause_reason: `High spam rate: ${(rates.spamRate * 100).toFixed(2)}%`,
        })
        .eq('id', inbox.id);

      await this.supabase
        .from('inbox_events')
        .insert({
          team_id: inbox.team_id,
          inbox_id: inbox.id,
          event_type: 'auto_paused',
          metadata: {
            reason: 'high_spam_rate',
            spam_rate: rates.spamRate,
            threshold: 0.01,
          },
        });

      return { paused: true };
    }

    return { paused: false };
  }

  private async getInboxRates(inboxId: string): Promise<{ bounceRate: number; spamRate: number }> {
    try {
      // Get total sent emails
      const { count: totalSent } = await this.supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('inbox_id', inboxId)
        .eq('status', 'sent');

      if (!totalSent || totalSent < 50) {
        // Not enough data for meaningful rates
        return { bounceRate: 0, spamRate: 0 };
      }

      // Get bounced emails
      const { count: bounceCount } = await this.supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('inbox_id', inboxId)
        .eq('status', 'bounced');

      // Get spam complaints (hard bounces with complaint type)
      const { count: spamCount } = await this.supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('inbox_id', inboxId)
        .eq('bounce_type', 'complaint');

      const bounceRate = (bounceCount ?? 0) / totalSent;
      const spamRate = (spamCount ?? 0) / totalSent;

      return { bounceRate, spamRate };
    } catch (error) {
      console.error('Failed to get inbox rates:', error);
      return { bounceRate: 0, spamRate: 0 };
    }
  }
}
