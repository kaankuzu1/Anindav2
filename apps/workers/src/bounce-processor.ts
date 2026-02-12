import { Worker, Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { transitionLeadStatus, getEventFromBounceType } from './utils/lead-state';

export type BounceType = 'hard' | 'soft' | 'complaint';

export interface BounceProcessJob {
  emailId: string;
  leadId: string;
  inboxId: string;
  campaignId?: string;
  bounceType: BounceType;
  bounceReason: string;
  diagnosticCode?: string;
}

const BOUNCE_RATE_THRESHOLD = 0.03; // 3% - industry standard for deliverability
const MIN_EMAILS_FOR_RATE = 50; // Minimum emails sent before rate calculation
const MAX_SOFT_BOUNCE_RETRIES = 3; // Maximum retries for soft bounces
const SOFT_BOUNCE_RETRY_DELAYS = [
  1 * 60 * 60 * 1000,  // 1 hour
  4 * 60 * 60 * 1000,  // 4 hours
  24 * 60 * 60 * 1000, // 24 hours
];

export class BounceProcessorWorker {
  private worker: Worker | null = null;
  private emailQueue: Queue | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.emailQueue = new Queue('email-send', { connection: redis });
  }

  start() {
    this.worker = new Worker<BounceProcessJob>(
      'bounce-process',
      async (job) => this.processJob(job),
      {
        connection: this.redis,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Bounce process job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Bounce process job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      if (!err.message.includes('ECONNRESET')) {
        console.error('Bounce processor worker error:', err.message);
      }
    });

    console.log('Bounce processor worker started');
  }

  async stop() {
    await this.worker?.close();
    await this.emailQueue?.close();
  }

  private async processJob(job: Job<BounceProcessJob>) {
    const { emailId, leadId, inboxId, campaignId, bounceType, bounceReason, diagnosticCode } = job.data;

    // Get email record
    const { data: email } = await this.supabase
      .from('emails')
      .select('*, leads(email)')
      .eq('id', emailId)
      .single();

    if (!email) {
      console.log(`Email not found: ${emailId}`);
      return { skipped: true, reason: 'email_not_found' };
    }

    // Get current retry count for soft bounces
    const currentRetryCount = email.soft_bounce_count ?? 0;

    // Handle soft bounces with retry logic
    if (bounceType === 'soft' && currentRetryCount < MAX_SOFT_BOUNCE_RETRIES) {
      // Schedule retry with exponential backoff
      const retryDelay = SOFT_BOUNCE_RETRY_DELAYS[currentRetryCount] ?? SOFT_BOUNCE_RETRY_DELAYS[SOFT_BOUNCE_RETRY_DELAYS.length - 1];

      // Update email with retry count
      await this.supabase
        .from('emails')
        .update({
          status: 'retry_pending',
          soft_bounce_count: currentRetryCount + 1,
          bounce_type: bounceType,
          bounce_reason: bounceReason,
          last_retry_at: new Date().toISOString(),
        })
        .eq('id', emailId);

      // Queue retry
      await this.emailQueue?.add(
        'send-email',
        {
          emailId,
          leadId,
          campaignId,
          inboxId,
          sequenceStep: email.sequence_step,
          isRetry: true,
          retryCount: currentRetryCount + 1,
        },
        {
          delay: retryDelay,
          jobId: `retry-${emailId}-${currentRetryCount + 1}`,
        }
      );

      console.log(`Soft bounce for email ${emailId}: Scheduled retry ${currentRetryCount + 1}/${MAX_SOFT_BOUNCE_RETRIES} in ${retryDelay / 1000 / 60} minutes`);

      // Log retry event
      await this.supabase
        .from('email_events')
        .insert({
          team_id: email.team_id,
          email_id: emailId,
          event_type: 'retry_scheduled',
          metadata: {
            bounce_type: bounceType,
            bounce_reason: bounceReason,
            retry_count: currentRetryCount + 1,
            retry_delay_ms: retryDelay,
          },
        });

      return {
        processed: true,
        bounceType,
        action: 'retry_scheduled',
        retryCount: currentRetryCount + 1,
      };
    }

    // For hard bounces or max retries exceeded, mark as bounced
    const isMaxRetriesExceeded = bounceType === 'soft' && currentRetryCount >= MAX_SOFT_BOUNCE_RETRIES;

    // Update email status
    await this.supabase
      .from('emails')
      .update({
        status: 'bounced',
        bounce_type: isMaxRetriesExceeded ? 'hard' : bounceType, // Convert to hard bounce if max retries
        bounce_reason: isMaxRetriesExceeded ? `${bounceReason} (max retries exceeded)` : bounceReason,
        bounced_at: new Date().toISOString(),
      })
      .eq('id', emailId);

    // Use state machine to transition lead status
    const effectiveBounceType = isMaxRetriesExceeded ? 'hard' : bounceType;
    const bounceEvent = getEventFromBounceType(effectiveBounceType);
    const stateChange = await transitionLeadStatus(
      this.supabase,
      leadId,
      bounceEvent,
      { bounceType: effectiveBounceType, bounceReason, diagnosticCode }
    );

    const leadStatus = stateChange?.newStatus ?? ((bounceType === 'hard' || isMaxRetriesExceeded) ? 'bounced' : 'soft_bounced');

    // If state machine blocked (e.g., already bounced), log but continue
    if (!stateChange) {
      console.warn(`State machine blocked bounce transition for lead ${leadId}, bounceType: ${effectiveBounceType}`);
    }

    // Add to suppression list for hard bounces (including soft bounces that exhausted retries)
    if (effectiveBounceType === 'hard' && email.leads?.email) {
      await this.addToSuppressionList(email.team_id, email.leads.email, 'hard_bounce', bounceReason);
    }

    // Add to suppression list for complaints (spam reports)
    if (bounceType === 'complaint' && email.leads?.email) {
      await this.addToSuppressionList(email.team_id, email.leads.email, 'spam_complaint', bounceReason);
    }

    // Increment inbox spam complaint counter (non-blocking)
    if (bounceType === 'complaint') {
      try {
        await this.supabase.rpc('increment_inbox_spam', { p_inbox_id: inboxId });
      } catch (err) {
        console.warn('Failed to increment spam count for inbox:', inboxId, err);
      }
    }

    // Log the bounce event
    await this.supabase
      .from('email_events')
      .insert({
        team_id: email.team_id,
        email_id: emailId,
        event_type: 'bounced',
        metadata: {
          bounce_type: bounceType,
          bounce_reason: bounceReason,
          diagnostic_code: diagnosticCode,
        },
      });

    // Update campaign bounce count
    if (campaignId) {
      await this.updateCampaignBounces(campaignId);
    }

    // Check inbox health and potentially pause
    await this.checkInboxHealth(inboxId);

    return {
      processed: true,
      bounceType,
      leadStatus,
    };
  }

  private async addToSuppressionList(
    teamId: string,
    email: string,
    reason: string,
    details?: string
  ): Promise<void> {
    try {
      // Check if already suppressed
      const { data: existing } = await this.supabase
        .from('suppression_list')
        .select('id')
        .eq('team_id', teamId)
        .eq('email', email.toLowerCase())
        .single();

      if (existing) {
        // Update existing entry
        await this.supabase
          .from('suppression_list')
          .update({
            reason,
            details,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Create new entry
        await this.supabase
          .from('suppression_list')
          .insert({
            team_id: teamId,
            email: email.toLowerCase(),
            reason,
            details,
          });
      }
    } catch (error) {
      console.error('Failed to add to suppression list:', error);
    }
  }

  private async updateCampaignBounces(campaignId: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_campaign_bounces', {
        campaign_id: campaignId,
      });
    } catch {
      // Fallback if RPC doesn't exist
      const { data } = await this.supabase
        .from('campaigns')
        .select('bounced_count')
        .eq('id', campaignId)
        .single();

      if (data) {
        await this.supabase
          .from('campaigns')
          .update({ bounced_count: (data.bounced_count ?? 0) + 1 })
          .eq('id', campaignId);
      }
    }
  }

  private async checkInboxHealth(inboxId: string): Promise<void> {
    try {
      // Get inbox stats
      const { data: inbox } = await this.supabase
        .from('inboxes')
        .select('sent_total, status')
        .eq('id', inboxId)
        .single();

      if (!inbox || inbox.status === 'paused') {
        return;
      }

      // Need minimum number of emails to calculate meaningful rate
      if ((inbox.sent_total ?? 0) < MIN_EMAILS_FOR_RATE) {
        return;
      }

      // Count bounces for this inbox
      const { count: bounceCount } = await this.supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('inbox_id', inboxId)
        .eq('status', 'bounced');

      if (bounceCount === null) {
        return;
      }

      const bounceRate = bounceCount / (inbox.sent_total ?? 1);

      // Auto-pause if bounce rate exceeds threshold
      if (bounceRate > BOUNCE_RATE_THRESHOLD) {
        console.log(`Inbox ${inboxId} bounce rate ${(bounceRate * 100).toFixed(2)}% exceeds threshold, pausing...`);

        await this.supabase
          .from('inboxes')
          .update({
            status: 'paused',
            paused_at: new Date().toISOString(),
            pause_reason: `High bounce rate: ${(bounceRate * 100).toFixed(2)}%`,
          })
          .eq('id', inboxId);

        // Log the pause event
        const { data: inboxData } = await this.supabase
          .from('inboxes')
          .select('team_id')
          .eq('id', inboxId)
          .single();

        if (inboxData) {
          await this.supabase
            .from('inbox_events')
            .insert({
              team_id: inboxData.team_id,
              inbox_id: inboxId,
              event_type: 'auto_paused',
              metadata: {
                reason: 'high_bounce_rate',
                bounce_rate: bounceRate,
                threshold: BOUNCE_RATE_THRESHOLD,
              },
            });
        }
      }
    } catch (error) {
      console.error('Failed to check inbox health:', error);
    }
  }
}
