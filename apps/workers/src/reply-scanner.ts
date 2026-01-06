import { Worker, Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GmailClient, MicrosoftClient } from '@aninda/email-client';
import { decrypt, extractPreview } from '@aninda/shared';

interface ScanRepliesJob {
  inboxId: string;
  since?: string;
}

type ReplyIntent =
  | 'interested'
  | 'meeting_request'
  | 'question'
  | 'not_interested'
  | 'unsubscribe'
  | 'out_of_office'
  | 'auto_reply'
  | 'bounce'
  | 'neutral';

export class ReplyScannerWorker {
  private worker: Worker | null = null;
  private encryptionKey: string;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.encryptionKey = process.env.ENCRYPTION_KEY!;
  }

  start() {
    this.worker = new Worker<ScanRepliesJob>(
      'reply-scan',
      async (job) => this.processJob(job),
      {
        connection: this.redis,
        concurrency: 2,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Reply scan job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Reply scan job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      if (!err.message.includes('ECONNRESET')) {
        console.error('Reply scanner worker error:', err.message);
      }
    });

    console.log('Reply scanner worker started');
  }

  async stop() {
    await this.worker?.close();
  }

  private async processJob(job: Job<ScanRepliesJob>) {
    const { inboxId, since } = job.data;

    // Get inbox
    const { data: inbox } = await this.supabase
      .from('inboxes')
      .select('*')
      .eq('id', inboxId)
      .single();

    if (!inbox) {
      throw new Error(`Inbox not found: ${inboxId}`);
    }

    // Decrypt credentials
    const accessToken = decrypt(inbox.oauth_access_token!, this.encryptionKey);
    const refreshToken = decrypt(inbox.oauth_refresh_token!, this.encryptionKey);

    // Determine since date
    const sinceDate = since
      ? new Date(since)
      : inbox.last_reply_checked_at
      ? new Date(inbox.last_reply_checked_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

    let messages: any[] = [];

    if (inbox.provider === 'google') {
      const gmailClient = new GmailClient(
        { accessToken, refreshToken },
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!
      );

      messages = await gmailClient.getMessages(sinceDate, 50);
    } else if (inbox.provider === 'microsoft') {
      const msClient = new MicrosoftClient({ accessToken, refreshToken });
      messages = await msClient.getMessages(sinceDate, 50);
    }

    let processedCount = 0;

    for (const message of messages) {
      // Check if this is a reply to one of our sent emails
      if (!message.inReplyTo) continue;

      // Find the original email we sent
      const { data: originalEmail } = await this.supabase
        .from('emails')
        .select('*, leads(*)')
        .eq('message_id', message.inReplyTo)
        .eq('inbox_id', inboxId)
        .single();

      if (!originalEmail) continue;

      // Check if we already processed this reply
      const { data: existingReply } = await this.supabase
        .from('replies')
        .select('id')
        .eq('message_id', message.id ?? message.messageId)
        .single();

      if (existingReply) continue;

      // Classify intent
      const intent = this.classifyIntent(message.body);

      // Create reply record
      await this.supabase
        .from('replies')
        .insert({
          team_id: originalEmail.team_id,
          email_id: originalEmail.id,
          lead_id: originalEmail.lead_id,
          inbox_id: inboxId,
          campaign_id: originalEmail.campaign_id,
          message_id: message.id ?? message.messageId,
          thread_id: message.threadId ?? message.conversationId,
          in_reply_to: message.inReplyTo,
          from_email: message.from,
          from_name: message.fromName,
          subject: message.subject,
          body_html: message.bodyHtml,
          body_text: message.body,
          body_preview: extractPreview(message.body),
          intent,
          intent_confidence: 0.8,
          intent_model: 'rule_based',
          received_at: message.receivedAt.toISOString(),
        });

      // Update lead status based on intent
      let leadStatus = 'replied';
      if (intent === 'interested' || intent === 'meeting_request') {
        leadStatus = 'interested';
      } else if (intent === 'not_interested' || intent === 'unsubscribe') {
        leadStatus = 'not_interested';
      }

      await this.supabase
        .from('leads')
        .update({
          status: leadStatus,
          reply_intent: intent,
          replied_at: new Date().toISOString(),
        })
        .eq('id', originalEmail.lead_id);

      // Update campaign stats
      if (originalEmail.campaign_id) {
        try {
          await this.supabase.rpc('increment_campaign_replies', {
            campaign_id: originalEmail.campaign_id,
          });
        } catch {
          // Fallback if RPC doesn't exist
          const { data } = await this.supabase
            .from('campaigns')
            .select('replied_count')
            .eq('id', originalEmail.campaign_id)
            .single();

          if (data) {
            await this.supabase
              .from('campaigns')
              .update({ replied_count: (data.replied_count ?? 0) + 1 })
              .eq('id', originalEmail.campaign_id);
          }
        }
      }

      processedCount++;
    }

    // Update last checked time
    await this.supabase
      .from('inboxes')
      .update({
        last_reply_checked_at: new Date().toISOString(),
      })
      .eq('id', inboxId);

    return { processedCount };
  }

  private classifyIntent(body: string): ReplyIntent {
    const lowerBody = body.toLowerCase();

    // Out of Office
    if (
      lowerBody.includes('out of office') ||
      lowerBody.includes('on vacation') ||
      lowerBody.includes('automatic reply') ||
      lowerBody.includes('away from') ||
      lowerBody.includes('currently out')
    ) {
      return 'out_of_office';
    }

    // Bounce
    if (
      lowerBody.includes('delivery failed') ||
      lowerBody.includes('undeliverable') ||
      lowerBody.includes('mailbox not found') ||
      lowerBody.includes('address rejected') ||
      lowerBody.includes('user unknown')
    ) {
      return 'bounce';
    }

    // Unsubscribe
    if (
      lowerBody.includes('unsubscribe') ||
      lowerBody.includes('remove me') ||
      lowerBody.includes('stop emailing') ||
      lowerBody.includes('take me off') ||
      lowerBody.includes('opt out')
    ) {
      return 'unsubscribe';
    }

    // Not interested
    if (
      lowerBody.includes('not interested') ||
      lowerBody.includes('no thanks') ||
      lowerBody.includes('no thank you') ||
      lowerBody.includes('not a good fit') ||
      lowerBody.includes('not looking') ||
      lowerBody.includes("don't contact")
    ) {
      return 'not_interested';
    }

    // Meeting request
    if (
      lowerBody.includes('schedule') ||
      lowerBody.includes('calendar') ||
      lowerBody.includes('meet') ||
      lowerBody.includes('call') ||
      lowerBody.includes('available') ||
      lowerBody.includes('demo')
    ) {
      return 'meeting_request';
    }

    // Interested
    if (
      lowerBody.includes('interested') ||
      lowerBody.includes('tell me more') ||
      lowerBody.includes('learn more') ||
      lowerBody.includes('sounds good') ||
      lowerBody.includes('sounds great') ||
      lowerBody.includes("let's chat") ||
      lowerBody.includes("let's talk")
    ) {
      return 'interested';
    }

    // Question
    if (body.includes('?')) {
      return 'question';
    }

    return 'neutral';
  }
}
