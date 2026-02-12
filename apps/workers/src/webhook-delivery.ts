import { Worker, Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateWebhookSignature } from '@aninda/shared';

export type WebhookEventType =
  | 'email.sent'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'reply.received'
  | 'reply.interested'
  | 'lead.bounced'
  | 'lead.unsubscribed'
  | 'campaign.started'
  | 'campaign.completed'
  | 'campaign.paused'
  | 'inbox.paused'
  | 'inbox.error';

export interface WebhookDeliveryJob {
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  attempt: number;
}

const MAX_ATTEMPTS = 5;
const TIMEOUT_MS = 10000; // 10 seconds

export class WebhookDeliveryWorker {
  private worker: Worker | null = null;
  private queue: Queue<WebhookDeliveryJob>;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.queue = new Queue<WebhookDeliveryJob>('webhook-delivery', { connection: redis });
  }

  start() {
    this.worker = new Worker<WebhookDeliveryJob>(
      'webhook-delivery',
      async (job) => this.processJob(job),
      {
        connection: this.redis,
        concurrency: 10,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Webhook delivery job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Webhook delivery job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      if (!err.message.includes('ECONNRESET')) {
        console.error('Webhook delivery worker error:', err.message);
      }
    });

    console.log('Webhook delivery worker started');
  }

  async stop() {
    await this.worker?.close();
    await this.queue.close();
  }

  /**
   * Queue a webhook delivery job
   */
  async queueDelivery(
    teamId: string,
    eventType: WebhookEventType,
    payload: Record<string, unknown>
  ): Promise<void> {
    // Get all active webhooks for this team that subscribe to this event
    const { data: webhooks, error } = await this.supabase
      .from('webhooks')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch webhooks:', error);
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      return;
    }

    // Filter webhooks that subscribe to this event type
    // Note: In a real implementation, you'd check the 'events' column
    // For now, we'll deliver to all active webhooks

    for (const webhook of webhooks) {
      try {
        await this.queue.add(
          'deliver-webhook',
          {
            webhookId: webhook.id,
            eventType,
            payload,
            attempt: 1,
          },
          {
            removeOnComplete: 100,
            removeOnFail: 50,
          }
        );
      } catch (error) {
        console.error(`Failed to queue webhook delivery for ${webhook.id}:`, error);
      }
    }
  }

  private async processJob(job: Job<WebhookDeliveryJob>) {
    const { webhookId, eventType, payload, attempt } = job.data;

    // Get webhook config
    const { data: webhook, error: webhookError } = await this.supabase
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (webhookError || !webhook) {
      console.log(`Webhook not found: ${webhookId}`);
      return { skipped: true, reason: 'webhook_not_found' };
    }

    if (!webhook.is_active) {
      console.log(`Webhook is inactive: ${webhookId}`);
      return { skipped: true, reason: 'webhook_inactive' };
    }

    // Build the payload
    const body = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    // Sign the payload with HMAC-SHA256
    const signature = generateWebhookSignature(body, webhook.secret);

    // Deliver the webhook
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': eventType,
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Timestamp': new Date().toISOString(),
          'X-Webhook-Id': webhookId,
          'User-Agent': 'Aninda-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Log successful delivery
      await this.logDelivery(webhookId, eventType, 'success', response.status);

      return { delivered: true, status: response.status };
    } catch (error: any) {
      const errorMessage = error.name === 'AbortError' ? 'Timeout' : error.message;

      // Log failed delivery
      await this.logDelivery(webhookId, eventType, 'failed', 0, errorMessage);

      // Retry with exponential backoff if under max attempts
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s, 32s

        await this.queue.add(
          'deliver-webhook',
          {
            webhookId,
            eventType,
            payload,
            attempt: attempt + 1,
          },
          {
            delay,
            removeOnComplete: 100,
            removeOnFail: 50,
          }
        );

        console.log(`Webhook delivery failed (attempt ${attempt}), retrying in ${delay}ms`);
      } else {
        console.error(`Webhook delivery failed after ${MAX_ATTEMPTS} attempts: ${webhookId}`);

        // Optionally disable the webhook after too many failures
        // await this.disableWebhook(webhookId, 'max_retries_exceeded');
      }

      throw error;
    }
  }

  private async logDelivery(
    webhookId: string,
    eventType: string,
    status: 'success' | 'failed',
    httpStatus: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('webhook_deliveries')
        .insert({
          webhook_id: webhookId,
          event_type: eventType,
          status,
          http_status: httpStatus,
          error_message: errorMessage,
        });
    } catch (error) {
      // Don't fail the job if logging fails
      console.error('Failed to log webhook delivery:', error);
    }
  }
}

/**
 * Create a standalone webhook dispatcher for use in other workers
 */
export function createWebhookDispatcher(redis: Redis, supabase: SupabaseClient) {
  const queue = new Queue<WebhookDeliveryJob>('webhook-delivery', { connection: redis });

  return {
    async dispatch(
      teamId: string,
      eventType: WebhookEventType,
      payload: Record<string, unknown>
    ): Promise<void> {
      // Get all active webhooks for this team
      const { data: webhooks } = await supabase
        .from('webhooks')
        .select('id, events')
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (!webhooks || webhooks.length === 0) {
        return;
      }

      for (const webhook of webhooks) {
        // Check if webhook subscribes to this event type
        const events = webhook.events as string[] | null;
        if (events && !events.includes(eventType)) {
          continue;
        }

        await queue.add(
          'deliver-webhook',
          {
            webhookId: webhook.id,
            eventType,
            payload,
            attempt: 1,
          },
          {
            removeOnComplete: 100,
            removeOnFail: 50,
          }
        );
      }
    },

    async close(): Promise<void> {
      await queue.close();
    },
  };
}
