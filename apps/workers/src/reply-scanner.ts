import { Worker, Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GmailClient, MicrosoftClient } from '@aninda/email-client';
import { decrypt, extractPreview } from '@aninda/shared';
import { transitionLeadStatus, replyIntentToEvent } from './utils/lead-state';

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

// Intents that should stop the campaign sequence for this lead
const SEQUENCE_STOP_INTENTS: ReplyIntent[] = ['interested', 'meeting_request', 'not_interested', 'unsubscribe', 'bounce'];

// Intents that should add the email to suppression list
const SUPPRESSION_INTENTS: ReplyIntent[] = ['unsubscribe', 'bounce'];

// OpenRouter API configuration for AI classification
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'openai/gpt-4o-mini';
const AI_CONFIDENCE_THRESHOLD = 0.7; // Use AI if rule-based confidence is below this

export class ReplyScannerWorker {
  private worker: Worker | null = null;
  private webhookQueue: Queue | null = null;
  private encryptionKey: string;
  private openRouterApiKey: string;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.encryptionKey = process.env.ENCRYPTION_KEY!;
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
    this.webhookQueue = new Queue('webhook-delivery', { connection: redis });
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
    await this.webhookQueue?.close();
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

      // Classify intent with rule-based first, then AI if needed
      const { intent, confidence, model } = await this.classifyIntentWithAI(message.body);

      // Create reply record
      const { data: replyData } = await this.supabase
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
          intent_confidence: confidence,
          intent_model: model,
          received_at: message.receivedAt.toISOString(),
        })
        .select('id')
        .single();

      // Update A/B test variant replied count
      if (originalEmail.variant_id) {
        try {
          await this.supabase.rpc('increment_variant_stat', {
            p_variant_id: originalEmail.variant_id,
            p_stat: 'replied',
          });
        } catch (err) {
          console.warn('Failed to increment variant replied count:', err);
        }
      }

      // ============================================
      // Category-Triggered Workflows
      // ============================================

      // Use state machine to transition lead status based on intent
      const leadEvent = replyIntentToEvent(intent);
      const stateChange = await transitionLeadStatus(
        this.supabase,
        originalEmail.lead_id,
        leadEvent,
        { intent, confidence, replyId: replyData?.id }
      );

      // Log if state machine blocked the transition (shouldn't happen for replies)
      if (!stateChange) {
        console.warn(`State machine blocked reply transition for lead ${originalEmail.lead_id}, intent: ${intent}`);
        // Still update reply_intent even if status can't change
        await this.supabase
          .from('leads')
          .update({ reply_intent: intent })
          .eq('id', originalEmail.lead_id);
      }

      // Auto-add to suppression list for unsubscribe/bounce intents
      if (SUPPRESSION_INTENTS.includes(intent)) {
        await this.addToSuppressionList(
          originalEmail.team_id,
          message.from,
          intent === 'unsubscribe' ? 'unsubscribe_request' : 'bounce_detected',
          `Detected from reply: ${intent}`
        );
      }

      // Trigger webhook for reply event
      await this.triggerWebhook(originalEmail.team_id, 'reply.received', {
        reply_id: replyData?.id,
        lead_id: originalEmail.lead_id,
        campaign_id: originalEmail.campaign_id,
        email_id: originalEmail.id,
        intent,
        intent_confidence: confidence,
        from_email: message.from,
        subject: message.subject,
        body_preview: extractPreview(message.body, 200),
        received_at: message.receivedAt.toISOString(),
      });

      // Trigger specific intent webhook
      if (intent !== 'neutral') {
        await this.triggerWebhook(originalEmail.team_id, `reply.${intent}`, {
          reply_id: replyData?.id,
          lead_id: originalEmail.lead_id,
          campaign_id: originalEmail.campaign_id,
          from_email: message.from,
        });
      }

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

  /**
   * Classify intent with rule-based first, then AI if confidence is low
   */
  private async classifyIntentWithAI(body: string): Promise<{ intent: ReplyIntent; confidence: number; model: string }> {
    // First, try rule-based classification
    const ruleResult = this.classifyIntentRuleBased(body);

    // If rule-based has high confidence, use it
    if (ruleResult.confidence >= AI_CONFIDENCE_THRESHOLD) {
      return { ...ruleResult, model: 'rule_based' };
    }

    // If rule-based is uncertain and we have an API key, use AI
    if (this.openRouterApiKey && ruleResult.intent === 'neutral') {
      try {
        const aiResult = await this.classifyWithAI(body);
        if (aiResult) {
          return { ...aiResult, model: 'gpt-4o-mini' };
        }
      } catch (error) {
        console.error('AI classification failed, falling back to rule-based:', error);
      }
    }

    return { ...ruleResult, model: 'rule_based' };
  }

  /**
   * Rule-based intent classification
   */
  private classifyIntentRuleBased(body: string): { intent: ReplyIntent; confidence: number } {
    const lowerBody = body.toLowerCase();

    // Out of Office - high confidence patterns
    if (
      lowerBody.includes('out of office') ||
      lowerBody.includes('on vacation') ||
      lowerBody.includes('automatic reply') ||
      lowerBody.includes('away from') ||
      lowerBody.includes('currently out')
    ) {
      return { intent: 'out_of_office', confidence: 0.95 };
    }

    // Bounce - high confidence patterns
    if (
      lowerBody.includes('delivery failed') ||
      lowerBody.includes('undeliverable') ||
      lowerBody.includes('mailbox not found') ||
      lowerBody.includes('address rejected') ||
      lowerBody.includes('user unknown')
    ) {
      return { intent: 'bounce', confidence: 0.95 };
    }

    // Unsubscribe - high confidence patterns
    if (
      lowerBody.includes('unsubscribe') ||
      lowerBody.includes('remove me') ||
      lowerBody.includes('stop emailing') ||
      lowerBody.includes('take me off') ||
      lowerBody.includes('opt out')
    ) {
      return { intent: 'unsubscribe', confidence: 0.9 };
    }

    // Not interested - medium-high confidence patterns
    if (
      lowerBody.includes('not interested') ||
      lowerBody.includes('no thanks') ||
      lowerBody.includes('no thank you') ||
      lowerBody.includes('not a good fit') ||
      lowerBody.includes('not looking') ||
      lowerBody.includes("don't contact")
    ) {
      return { intent: 'not_interested', confidence: 0.85 };
    }

    // Meeting request - medium confidence (can have false positives)
    if (
      lowerBody.includes('schedule a call') ||
      lowerBody.includes('book a meeting') ||
      lowerBody.includes('set up a demo') ||
      lowerBody.includes('calendar invite') ||
      lowerBody.includes('are you available')
    ) {
      return { intent: 'meeting_request', confidence: 0.85 };
    }

    // Less specific meeting indicators (lower confidence)
    if (
      lowerBody.includes('schedule') ||
      lowerBody.includes('calendar') ||
      lowerBody.includes('meet') ||
      lowerBody.includes('call') ||
      lowerBody.includes('available') ||
      lowerBody.includes('demo')
    ) {
      return { intent: 'meeting_request', confidence: 0.6 };
    }

    // Interested - medium confidence patterns
    if (
      lowerBody.includes('interested') ||
      lowerBody.includes('tell me more') ||
      lowerBody.includes('learn more') ||
      lowerBody.includes('sounds good') ||
      lowerBody.includes('sounds great') ||
      lowerBody.includes("let's chat") ||
      lowerBody.includes("let's talk")
    ) {
      return { intent: 'interested', confidence: 0.8 };
    }

    // Question - low confidence (needs context)
    if (body.includes('?')) {
      return { intent: 'question', confidence: 0.5 };
    }

    return { intent: 'neutral', confidence: 0.4 };
  }

  /**
   * AI-powered intent classification using OpenRouter
   */
  private async classifyWithAI(body: string): Promise<{ intent: ReplyIntent; confidence: number } | null> {
    const prompt = `Classify the intent of this email reply. Return ONLY a JSON object with "intent" and "confidence" fields.

Intent must be one of: interested, meeting_request, question, not_interested, unsubscribe, out_of_office, auto_reply, bounce, neutral

Confidence is a number between 0 and 1.

Email:
${body.slice(0, 1000)}

Response (JSON only):`;

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'HTTP-Referer': process.env.API_URL || 'http://localhost:3001',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content?.trim() || '';

      // Parse JSON response
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.intent && typeof parsed.confidence === 'number') {
          return {
            intent: parsed.intent as ReplyIntent,
            confidence: Math.min(1, Math.max(0, parsed.confidence)),
          };
        }
      }
    } catch (error) {
      console.error('AI classification error:', error);
    }

    return null;
  }

  /**
   * Add email to suppression list
   */
  private async addToSuppressionList(
    teamId: string,
    email: string,
    reason: string,
    details: string
  ): Promise<void> {
    try {
      const { data: existing } = await this.supabase
        .from('suppression_list')
        .select('id')
        .eq('team_id', teamId)
        .eq('email', email.toLowerCase())
        .single();

      if (!existing) {
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

  /**
   * Trigger webhook for an event
   */
  private async triggerWebhook(
    teamId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      // Find active webhooks for this team and event
      const { data: webhooks } = await this.supabase
        .from('webhooks')
        .select('*')
        .eq('team_id', teamId)
        .eq('enabled', true)
        .contains('events', [eventType]);

      if (!webhooks || webhooks.length === 0) return;

      // Queue webhook delivery for each matching webhook
      for (const webhook of webhooks) {
        await this.webhookQueue?.add(
          'deliver',
          {
            webhookId: webhook.id,
            eventType,
            payload: {
              event: eventType,
              timestamp: new Date().toISOString(),
              data: payload,
            },
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          }
        );
      }
    } catch (error) {
      console.error('Failed to trigger webhook:', error);
    }
  }
}
