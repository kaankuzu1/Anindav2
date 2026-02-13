import { Worker, Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GmailClient, MicrosoftClient } from '@aninda/email-client';
import { calculateWarmupQuota, decrypt, encrypt, randomDelay, processEmailContent } from '@aninda/shared';
import { WARMUP_TEMPLATES, WARMUP_REPLY_TEMPLATES, WARMUP_CONTINUATION_TEMPLATES, WARMUP_CLOSER_TEMPLATES } from './warmup-templates';
import { getNextTemplateIndex } from './warmup-dedup';

interface WarmupSendJob {
  fromInboxId: string;
  toInboxId: string;
  isNetworkWarmup?: boolean;
}

interface WarmupReplyJob {
  originalMessageId: string;
  toInboxId: string;
  fromInboxId: string;
  threadId: string;
  originalSubject?: string;   // Actual subject of the thread for Re: prefix
  threadDepth?: number;       // Current depth of the thread (1 = initial reply)
  maxThreadDepth?: number;    // Target depth for this thread (2-5)
  isNetworkWarmup?: boolean;
}

interface ResolvedInbox {
  id: string;
  email: string;
  provider: string;
  from_name?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt?: Date;
  isAdmin: boolean;
}

/**
 * Extract first name from a from_name string (e.g., "John Smith" → "John").
 * Returns undefined if no name is available.
 */
function extractFirstName(fromName?: string | null): string | undefined {
  if (!fromName) return undefined;
  const trimmed = fromName.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

export class WarmupWorker {
  private sendWorker: Worker | null = null;
  private replyWorker: Worker | null = null;
  private warmupQueue: Queue;
  private encryptionKey: string;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.encryptionKey = process.env.ENCRYPTION_KEY!;
    this.warmupQueue = new Queue('warmup', { connection: redis });
  }

  start() {
    // Worker for sending warmup emails
    this.sendWorker = new Worker<WarmupSendJob>(
      'warmup-send',
      async (job) => this.processSendJob(job),
      {
        connection: this.redis,
        concurrency: 3,
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            // Exponential backoff: 1min, 2min, 4min, 8min, max 15min
            return Math.min(Math.pow(2, attemptsMade) * 60 * 1000, 15 * 60 * 1000);
          },
        },
      }
    );

    // Worker for replying to warmup emails
    this.replyWorker = new Worker<WarmupReplyJob>(
      'warmup-reply',
      async (job) => this.processReplyJob(job),
      {
        connection: this.redis,
        concurrency: 3,
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            // Exponential backoff: 1min, 2min, 4min, 8min, max 15min
            return Math.min(Math.pow(2, attemptsMade) * 60 * 1000, 15 * 60 * 1000);
          },
        },
      }
    );

    this.sendWorker.on('completed', (job) => {
      console.log(`Warmup send job ${job.id} completed`);
    });

    this.sendWorker.on('failed', (job, err) => {
      const attempts = job?.attemptsMade ?? 0;
      console.error(`Warmup send job ${job?.id} failed (attempt ${attempts}/3):`, err.message);
    });

    this.sendWorker.on('error', (err) => {
      if (!err.message.includes('ECONNRESET')) {
        console.error('Warmup send worker error:', err.message);
      }
    });

    this.replyWorker.on('completed', (job) => {
      console.log(`Warmup reply job ${job.id} completed`);
    });

    this.replyWorker.on('failed', (job, err) => {
      const attempts = job?.attemptsMade ?? 0;
      console.error(`Warmup reply job ${job?.id} failed (attempt ${attempts}/3):`, err.message);
    });

    this.replyWorker.on('error', (err) => {
      if (!err.message.includes('ECONNRESET')) {
        console.error('Warmup reply worker error:', err.message);
      }
    });

    console.log('Warmup worker started');
  }

  async stop() {
    await this.sendWorker?.close();
    await this.replyWorker?.close();
  }

  /**
   * Resolves an inbox ID (regular or admin:prefixed) to a normalized inbox object with credentials
   */
  private async resolveInbox(idOrRef: string): Promise<ResolvedInbox> {
    const isAdmin = idOrRef.startsWith('admin:');
    const actualId = isAdmin ? idOrRef.replace('admin:', '') : idOrRef;
    const table = isAdmin ? 'admin_inboxes' : 'inboxes';

    const { data: inbox, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('id', actualId)
      .single();

    if (error || !inbox) {
      throw new Error(`${isAdmin ? 'Admin inbox' : 'Inbox'} not found: ${actualId}`);
    }

    // Decrypt credentials
    let accessToken: string;
    let refreshToken: string;

    try {
      if (inbox.oauth_access_token?.includes(':')) {
        accessToken = decrypt(inbox.oauth_access_token, this.encryptionKey);
        refreshToken = decrypt(inbox.oauth_refresh_token, this.encryptionKey);
      } else {
        accessToken = inbox.oauth_access_token!;
        refreshToken = inbox.oauth_refresh_token!;
      }
    } catch (e) {
      accessToken = inbox.oauth_access_token!;
      refreshToken = inbox.oauth_refresh_token!;
    }

    return {
      id: actualId,
      email: inbox.email,
      provider: inbox.provider,
      from_name: inbox.from_name,
      accessToken,
      refreshToken,
      expiresAt: inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined,
      isAdmin,
    };
  }

  /**
   * Creates an email client for the given inbox (supports Gmail and Microsoft)
   */
  private createEmailClient(inbox: ResolvedInbox): GmailClient | MicrosoftClient {
    if (inbox.provider === 'microsoft') {
      const table = inbox.isAdmin ? 'admin_inboxes' : 'inboxes';
      return new MicrosoftClient(
        {
          accessToken: inbox.accessToken,
          refreshToken: inbox.refreshToken,
          expiresAt: inbox.expiresAt,
        },
        {
          clientId: process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
          onTokenRefresh: async (newCreds) => {
            const encAccessToken = encrypt(newCreds.accessToken, this.encryptionKey);
            const encRefreshToken = encrypt(newCreds.refreshToken, this.encryptionKey);
            await this.supabase
              .from(table)
              .update({
                oauth_access_token: encAccessToken,
                oauth_refresh_token: encRefreshToken,
                oauth_expires_at: newCreds.expiresAt?.toISOString() ?? null,
              })
              .eq('id', inbox.id);
          },
        },
      );
    }

    // Default: Gmail
    return new GmailClient(
      { accessToken: inbox.accessToken, refreshToken: inbox.refreshToken },
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
    );
  }

  private async processSendJob(job: Job<WarmupSendJob>) {
    const { fromInboxId, toInboxId, isNetworkWarmup } = job.data;

    // Resolve both inboxes
    const fromInbox = await this.resolveInbox(fromInboxId);
    const toInbox = await this.resolveInbox(toInboxId);

    // Create email client
    const client = this.createEmailClient(fromInbox);

    // Pick template using dedup (no repeats until full cycle)
    const templateIndex = await getNextTemplateIndex(this.redis, fromInbox.id, toInbox.id, 'main', WARMUP_TEMPLATES.length);
    const template = WARMUP_TEMPLATES[templateIndex];

    // Build variable map for personalization
    const variables: Record<string, string | undefined> = {
      firstName: extractFirstName(toInbox.from_name),
      first_name: extractFirstName(toInbox.from_name),
      senderFirstName: extractFirstName(fromInbox.from_name),
      sender_first_name: extractFirstName(fromInbox.from_name),
    };

    // Process variables in subject and body
    const subject = processEmailContent(template.subject, variables);
    const body = processEmailContent(template.body, variables);

    // Send email
    let result: { messageId: string; threadId?: string; conversationId?: string };
    try {
      result = await client.sendEmail({
        to: toInbox.email,
        from: fromInbox.email,
        fromName: fromInbox.from_name ?? undefined,
        subject,
        htmlBody: body.split('\n').map(line => `<p>${line}</p>`).join(''),
      });
    } catch (sendError: any) {
      if (this.isAuthError(sendError)) {
        console.error(`Warmup send: Auth error — marking inbox ${fromInbox.email} as disconnected`);
        await this.markDisconnected(fromInboxId, fromInbox.isAdmin);
        const err = new Error('Inbox disconnected — authorization expired');
        (err as any).nonRetryable = true;
        throw err;
      }
      throw sendError;
    }
    const resultThreadId = result.threadId ?? result.conversationId ?? null;

    // Log interaction
    if (isNetworkWarmup) {
      const userInboxId = fromInbox.isAdmin ? toInbox.id : fromInbox.id;
      const adminInboxId = fromInbox.isAdmin ? fromInbox.id : toInbox.id;
      const direction = fromInbox.isAdmin ? 'admin_to_user' : 'user_to_admin';

      await this.supabase
        .from('admin_warmup_interactions')
        .insert({
          user_inbox_id: userInboxId,
          admin_inbox_id: adminInboxId,
          direction,
          interaction_type: 'sent',
          message_id: result.messageId,
          thread_id: resultThreadId,
          subject,
        });

      // Update admin inbox counters
      const adminId = fromInbox.isAdmin ? fromInbox.id : toInbox.id;
      const { data: adminState } = await this.supabase
        .from('admin_inboxes')
        .select('sent_today, sent_total')
        .eq('id', adminId)
        .single();

      if (adminState) {
        await this.supabase
          .from('admin_inboxes')
          .update({
            sent_today: (adminState.sent_today ?? 0) + (fromInbox.isAdmin ? 1 : 0),
            sent_total: (adminState.sent_total ?? 0) + (fromInbox.isAdmin ? 1 : 0),
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', adminId);
      }
    } else {
      await this.supabase
        .from('warmup_interactions')
        .insert({
          from_inbox_id: fromInbox.id,
          to_inbox_id: toInbox.id,
          interaction_type: 'sent',
          message_id: result.messageId,
          thread_id: resultThreadId,
          subject,
        });
    }

    // Update user warmup state counters (for the sending user inbox)
    const userInboxId = fromInbox.isAdmin ? toInbox.id : fromInbox.id;
    if (!fromInbox.isAdmin) {
      const { data: warmupState } = await this.supabase
        .from('warmup_state')
        .select('sent_today, sent_total')
        .eq('inbox_id', userInboxId)
        .single();

      await this.supabase
        .from('warmup_state')
        .update({
          sent_today: (warmupState?.sent_today ?? 0) + 1,
          sent_total: (warmupState?.sent_total ?? 0) + 1,
          last_activity_at: new Date().toISOString(),
        })
        .eq('inbox_id', userInboxId);
    }

    // Schedule reply with random delay (2-30 minutes)
    const delay = randomDelay(2 * 60 * 1000, 30 * 60 * 1000);

    // Determine thread depth: 50% chance of multi-level thread (2-5 messages)
    const isMultiLevel = Math.random() < 0.5;
    const maxThreadDepth = isMultiLevel ? Math.floor(Math.random() * 4) + 2 : 1; // 2-5 or just 1

    await this.warmupQueue.add(
      'warmup-reply',
      {
        originalMessageId: result.messageId,
        toInboxId: fromInboxId,
        fromInboxId: toInboxId,
        threadId: result.threadId,
        originalSubject: subject,
        threadDepth: 1,
        maxThreadDepth,
        isNetworkWarmup,
      } as WarmupReplyJob,
      {
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
      }
    );

    return { messageId: result.messageId, maxThreadDepth };
  }

  private async processReplyJob(job: Job<WarmupReplyJob>) {
    const { originalMessageId, toInboxId, fromInboxId, threadId, originalSubject, threadDepth = 1, maxThreadDepth = 1, isNetworkWarmup } = job.data;

    // Resolve inbox
    const fromInbox = await this.resolveInbox(fromInboxId);
    const toInbox = await this.resolveInbox(toInboxId);

    // Create email client
    const client = this.createEmailClient(fromInbox);

    // Mark original as read and starred (engagement signals) — only for Gmail
    if (client instanceof GmailClient) {
      await client.markAsRead(originalMessageId);
      await client.addStar(originalMessageId);
    }

    // Pick appropriate reply template based on thread depth (with dedup)
    const isLastReply = threadDepth >= maxThreadDepth;
    let templateBody: string;

    if (threadDepth === 1) {
      const idx = await getNextTemplateIndex(this.redis, fromInbox.id, toInbox.id, 'reply', WARMUP_REPLY_TEMPLATES.length);
      templateBody = WARMUP_REPLY_TEMPLATES[idx].body;
    } else if (isLastReply) {
      const idx = await getNextTemplateIndex(this.redis, fromInbox.id, toInbox.id, 'closer', WARMUP_CLOSER_TEMPLATES.length);
      templateBody = WARMUP_CLOSER_TEMPLATES[idx].body;
    } else {
      const idx = await getNextTemplateIndex(this.redis, fromInbox.id, toInbox.id, 'continuation', WARMUP_CONTINUATION_TEMPLATES.length);
      templateBody = WARMUP_CONTINUATION_TEMPLATES[idx].body;
    }

    // Build variable map for personalization
    const variables: Record<string, string | undefined> = {
      firstName: extractFirstName(toInbox.from_name),
      first_name: extractFirstName(toInbox.from_name),
      senderFirstName: extractFirstName(fromInbox.from_name),
      sender_first_name: extractFirstName(fromInbox.from_name),
    };

    const replyBody = processEmailContent(templateBody, variables);

    // Use original thread subject with Re: prefix
    const replySubject = originalSubject
      ? (originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`)
      : 'Re: Quick question';

    // Send reply
    let result: { messageId: string; threadId?: string; conversationId?: string };
    try {
      result = await client.sendEmail({
        to: toInbox.email,
        from: fromInbox.email,
        fromName: fromInbox.from_name ?? undefined,
        subject: replySubject,
        htmlBody: replyBody.split('\n').map(line => `<p>${line}</p>`).join(''),
        inReplyTo: originalMessageId,
        references: originalMessageId,
      });
    } catch (sendError: any) {
      if (this.isAuthError(sendError)) {
        console.error(`Warmup reply: Auth error — marking inbox ${fromInbox.email} as disconnected`);
        await this.markDisconnected(fromInboxId, fromInbox.isAdmin);
        const err = new Error('Inbox disconnected — authorization expired');
        (err as any).nonRetryable = true;
        throw err;
      }
      throw sendError;
    }

    // Log interaction
    if (isNetworkWarmup) {
      const userInboxId = fromInbox.isAdmin ? toInbox.id : fromInbox.id;
      const adminInboxId = fromInbox.isAdmin ? fromInbox.id : toInbox.id;
      const direction = fromInbox.isAdmin ? 'admin_to_user' : 'user_to_admin';

      await this.supabase
        .from('admin_warmup_interactions')
        .insert({
          user_inbox_id: userInboxId,
          admin_inbox_id: adminInboxId,
          direction,
          interaction_type: 'replied',
          message_id: result.messageId,
          thread_id: threadId,
          thread_depth: threadDepth,
        });
    } else {
      await this.supabase
        .from('warmup_interactions')
        .insert({
          from_inbox_id: fromInbox.id,
          to_inbox_id: toInbox.id,
          interaction_type: 'replied',
          message_id: result.messageId,
          thread_id: threadId,
          thread_depth: threadDepth,
        });
    }

    // Update warmup state counters for user inbox
    const replyUserInboxId = fromInbox.isAdmin ? toInbox.id : fromInbox.id;
    if (!fromInbox.isAdmin) {
      const { data: warmupState } = await this.supabase
        .from('warmup_state')
        .select('replied_today, replied_total')
        .eq('inbox_id', replyUserInboxId)
        .single();

      await this.supabase
        .from('warmup_state')
        .update({
          replied_today: (warmupState?.replied_today ?? 0) + 1,
          replied_total: (warmupState?.replied_total ?? 0) + 1,
          last_activity_at: new Date().toISOString(),
        })
        .eq('inbox_id', replyUserInboxId);
    }

    // If we haven't reached max thread depth, schedule another reply from the other side
    if (threadDepth < maxThreadDepth) {
      // Swap from and to for the continuation (other person replies back)
      const nextDelay = randomDelay(5 * 60 * 1000, 45 * 60 * 1000); // 5-45 minutes for more natural conversation

      await this.warmupQueue.add(
        'warmup-reply',
        {
          originalMessageId: result.messageId,
          toInboxId: fromInboxId,  // Swap: original sender becomes recipient
          fromInboxId: toInboxId,   // Swap: original recipient becomes sender
          threadId,
          originalSubject,
          threadDepth: threadDepth + 1,
          maxThreadDepth,
          isNetworkWarmup,
        } as WarmupReplyJob,
        {
          delay: nextDelay,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000,
          },
        }
      );

      console.log(`Warmup thread ${threadId}: Scheduled reply ${threadDepth + 1}/${maxThreadDepth}`);
    } else {
      console.log(`Warmup thread ${threadId}: Completed with ${threadDepth} messages`);
    }

    return { messageId: result.messageId, threadDepth, maxThreadDepth };
  }

  private isAuthError(err: any): boolean {
    const msg = (err?.message ?? '').toLowerCase();
    const code = String(err?.code ?? err?.statusCode ?? '');
    return (
      code === '401' ||
      code === '403' ||
      msg.includes('unauthorized') ||
      msg.includes('invalid_grant') ||
      msg.includes('invalid_client') ||
      msg.includes('token expired') ||
      msg.includes('token has been expired') ||
      msg.includes('token has been revoked') ||
      msg.includes('refresh token') ||
      msg.includes('authentication') ||
      msg.includes('auth_error') ||
      msg.includes('auth error') ||
      msg.includes('insufficient permissions')
    );
  }

  private async markDisconnected(inboxIdOrRef: string, isAdmin: boolean): Promise<void> {
    if (isAdmin) {
      const actualId = inboxIdOrRef.startsWith('admin:') ? inboxIdOrRef.replace('admin:', '') : inboxIdOrRef;

      await this.supabase
        .from('admin_inboxes')
        .update({
          status: 'error',
          status_reason: 'Email account disconnected — please reconnect',
        })
        .eq('id', actualId);

      // Release all user assignments for this admin inbox
      const { data: assignments } = await this.supabase
        .from('admin_inbox_assignments')
        .select('inbox_id')
        .eq('admin_inbox_id', actualId);

      for (const assignment of assignments ?? []) {
        // Disable network warmup for assigned user inboxes
        await this.supabase
          .from('warmup_state')
          .update({ enabled: false, phase: 'paused' })
          .eq('inbox_id', assignment.inbox_id)
          .eq('warmup_mode', 'network');

        console.log(`Disabled network warmup for user inbox ${assignment.inbox_id} (admin inbox disconnected)`);
      }

      // Delete assignments
      await this.supabase
        .from('admin_inbox_assignments')
        .delete()
        .eq('admin_inbox_id', actualId);

      // Decrement current_load to 0
      await this.supabase
        .from('admin_inboxes')
        .update({ current_load: 0 })
        .eq('id', actualId);
    } else {
      // Regular user inbox disconnection
      await this.supabase
        .from('inboxes')
        .update({
          status: 'error',
          status_reason: 'Email account disconnected — please reconnect',
        })
        .eq('id', inboxIdOrRef);

      await this.supabase
        .from('warmup_state')
        .update({
          enabled: false,
          phase: 'paused',
        })
        .eq('inbox_id', inboxIdOrRef);

      // Cascade: check if this affects pool warmup for the team
      await this.cascadePoolWarmupCheck(inboxIdOrRef);
    }
  }

  /**
   * After disconnecting a user inbox, check if remaining pool inboxes in the team
   * have enough peers. If not, disable pool warmup for all remaining inboxes.
   */
  private async cascadePoolWarmupCheck(disconnectedInboxId: string): Promise<void> {
    // Get team_id for the disconnected inbox
    const { data: inbox } = await this.supabase
      .from('inboxes')
      .select('team_id')
      .eq('id', disconnectedInboxId)
      .single();

    if (!inbox) return;

    // Count remaining connected pool inboxes with warmup enabled
    const { data: poolInboxes } = await this.supabase
      .from('warmup_state')
      .select('inbox_id, inbox:inboxes(id, status, team_id)')
      .eq('enabled', true)
      .neq('warmup_mode', 'network');

    const teamPoolInboxes = (poolInboxes ?? []).filter((ws: any) => {
      const wsInbox = ws.inbox as any;
      return wsInbox?.team_id === inbox.team_id &&
        (wsInbox.status === 'active' || wsInbox.status === 'warming_up');
    });

    if (teamPoolInboxes.length < 2) {
      // Disable pool warmup for all remaining team inboxes
      for (const ws of teamPoolInboxes) {
        await this.supabase
          .from('warmup_state')
          .update({ enabled: false, phase: 'paused' })
          .eq('inbox_id', ws.inbox_id);

        console.log(`Cascade: Disabled pool warmup for ${ws.inbox_id} (insufficient pool peers in team)`);
      }
    }
  }
}
