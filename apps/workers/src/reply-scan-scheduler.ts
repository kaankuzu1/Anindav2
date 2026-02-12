import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ScanRepliesJob {
  inboxId: string;
  since?: string;
}

const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class ReplyScanScheduler {
  private replyScanQueue: Queue<ScanRepliesJob>;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.replyScanQueue = new Queue<ScanRepliesJob>('reply-scan', { connection: redis });
  }

  start() {
    console.log('Reply scan scheduler started');

    // Run immediately and then every 5 minutes
    this.scheduleScans();
    this.intervalId = setInterval(() => {
      this.scheduleScans();
    }, SCHEDULER_INTERVAL_MS);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.replyScanQueue.close();
  }

  private async scheduleScans() {
    try {
      console.log('Reply scan scheduler: Checking for inboxes to scan...');

      // Get all active inboxes with OAuth tokens
      const { data: inboxes, error } = await this.supabase
        .from('inboxes')
        .select('id, email, provider, last_reply_checked_at')
        .in('status', ['active', 'warming_up'])
        .not('oauth_access_token', 'is', null);

      if (error) {
        console.error('Reply scan scheduler: Failed to fetch inboxes:', error);
        return;
      }

      if (!inboxes || inboxes.length === 0) {
        console.log('Reply scan scheduler: No inboxes to scan');
        return;
      }

      console.log(`Reply scan scheduler: Found ${inboxes.length} inboxes to scan`);

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const hour = now.getHours();

      let scheduledCount = 0;

      for (const inbox of inboxes) {
        // Create unique job ID to prevent duplicates within the same hour
        const jobId = `reply-scan-${inbox.id}-${today}-${hour}`;

        try {
          await this.replyScanQueue.add(
            'scan-replies',
            {
              inboxId: inbox.id,
              since: inbox.last_reply_checked_at || undefined,
            },
            {
              jobId,
              removeOnComplete: 100,
              removeOnFail: 50,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
            }
          );

          scheduledCount++;
        } catch (error: any) {
          // Job already exists - this is expected if scheduler runs more frequently than scan completes
          if (!error.message?.includes('already exists')) {
            console.error(`Reply scan scheduler: Failed to queue scan for ${inbox.email}:`, error.message);
          }
        }
      }

      if (scheduledCount > 0) {
        console.log(`Reply scan scheduler: Scheduled ${scheduledCount} reply scans`);
      }
    } catch (error) {
      console.error('Reply scan scheduler error:', error);
    }
  }
}
