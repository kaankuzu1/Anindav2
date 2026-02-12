import { Worker, Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GmailClient, MicrosoftClient } from '@aninda/email-client';
import { calculateWarmupQuota, decrypt, encrypt, randomDelay } from '@aninda/shared';

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

const WARMUP_SUBJECTS = [
  // Questions
  'Quick question about our meeting',
  'Following up on our conversation',
  'Checking in on the project status',
  'Question about next steps',
  'Any updates on the proposal?',
  'Wondering about your availability',
  'Quick clarification needed',
  'Thoughts on the timeline?',

  // Casual check-ins
  'Just wanted to say hi',
  'Hope you had a great weekend',
  'How are things going?',
  'Touching base before the holidays',
  'Been a while - how are you?',
  'Quick hello from the team',
  'Hope your week is going well',

  // Updates
  'Quick update on our progress',
  'Some news to share',
  'Brief status update',
  'Wanted to keep you in the loop',
  'Updates from our end',
  'Progress report - looking good',

  // Requests
  'Could use your input',
  'Would love your thoughts',
  'Quick favor to ask',
  'Need your expertise on something',
  'Time for a quick chat?',

  // Professional casual
  'Re: Our discussion',
  'Following up as promised',
  'As we discussed earlier',
  'Circling back on this',
  'Per our last conversation',
  'Thanks for your time yesterday',
];

const WARMUP_BODIES = [
  // Friendly check-ins
  'Hope you\'re having a great day! Just wanted to check in and see how everything is going on your end. Let me know if there\'s anything I can help with.',

  'How\'s everything going? I was thinking about our last conversation and wanted to follow up. Hope things are progressing well!',

  'Just a quick note to say hello and see how things are going. It\'s been a busy week here, but I wanted to make sure we stay connected.',

  'Wanted to touch base with you and see if you had any questions. Happy to jump on a quick call if that would be helpful.',

  'Hope all is well on your end! I know things can get hectic, so just wanted to send a friendly reminder that I\'m here if you need anything.',

  // Professional updates
  'I wanted to give you a quick update on where things stand. We\'ve been making good progress and should have more to share soon. Let me know if you\'d like to discuss.',

  'Just following up on our previous discussion. I\'ve had some time to think things over and have a few ideas I\'d love to bounce off you when you have a moment.',

  'Hope your week is going well! I was reviewing some of the points we discussed and wanted to share some additional thoughts. Would love to hear your perspective.',

  'Checking in to see if you had a chance to review the information I sent over. No rush at all - just wanted to make sure it came through okay.',

  'I hope this email finds you well. I wanted to follow up and see if there\'s anything else you need from my end. Happy to help however I can.',

  // Casual professional
  'Hey! Hope you\'re doing well. Just wanted to drop a quick note and see how things are going. Let me know if you have time for a quick chat this week.',

  'I hope you had a great weekend! Just wanted to touch base and see if there\'s anything new on your end. Looking forward to catching up.',

  'Quick note to say thanks again for your time. I really appreciated our conversation and look forward to staying in touch.',

  'I was just thinking about our project and wanted to reach out. Hope everything is going smoothly. Let me know if there\'s anything I can do to help.',

  'Hope things are going great! I know we\'ve both been busy, but I wanted to make sure we keep the lines of communication open. Feel free to reach out anytime.',

  // Questions
  'I had a quick question come up and thought you might be the best person to ask. When you get a chance, could you let me know your thoughts? No rush!',

  'I was reviewing some notes and realized I had a question I forgot to ask. Would you mind sharing your thoughts when you have a moment?',

  'Something came up that made me think of our conversation. Would love to get your input when you have some time. Let me know what works for you.',

  'I hope you\'re having a productive week! I wanted to circle back on a few things we discussed. Let me know when would be a good time to connect.',

  'Just wanted to reach out and see if you had any updates. I\'m flexible on timing, so just let me know what works best for your schedule.',
];

const WARMUP_REPLIES = [
  // Appreciative
  'Thanks so much for reaching out! I really appreciate you taking the time to connect. Everything is going well on my end - hope the same is true for you!',

  'Got your message - thanks for the update! Things are moving along nicely here. Let\'s definitely stay in touch.',

  'I appreciate you checking in! It\'s always great to hear from you. Things are busy but good. Let me know if you need anything from my side.',

  // Positive responses
  'Thanks for the message! I\'ve been meaning to reach out as well. Great timing! Let\'s catch up soon when you have a moment.',

  'Great to hear from you! Thanks for keeping me in the loop. Everything sounds good. Looking forward to our next conversation.',

  'Thanks for following up! I was just thinking about this the other day. Let me know if you\'d like to schedule some time to discuss further.',

  // Casual friendly
  'Hey, thanks for reaching out! Hope you\'re doing well too. Things are going great here. Let\'s definitely connect soon!',

  'Thanks for the note! Always good to hear from you. I\'ll take a look at everything and get back to you if I have any questions.',

  'Appreciate you thinking of me! Everything is going smoothly on this end. Feel free to reach out anytime if you need anything.',

  // Professional
  'Thank you for the update - very helpful! I\'ll review everything and let you know if I have any questions. Looking forward to staying connected.',

  'Thanks for keeping me posted! This is really helpful. I\'ll circle back if anything comes up on my end.',

  'I appreciate the follow-up! Everything looks good from my perspective. Don\'t hesitate to reach out if there\'s anything else I can help with.',

  // Brief but warm
  'Thanks for checking in! All good here. Talk soon!',

  'Got it, thanks for the heads up! Let me know if you need anything else.',

  'Thanks so much! This is exactly what I needed. Hope your week is going well!',
];

// Thread continuation replies - for multi-level warmup threads
const WARMUP_THREAD_CONTINUATIONS = [
  // Follow-up questions
  'That\'s great to hear! By the way, I was wondering - do you have any updates on the timeline we discussed?',

  'Thanks for getting back to me! Just curious, have you had a chance to look into what we talked about last time?',

  'Good to know! Speaking of which, I wanted to ask - are you still planning to move forward with that project?',

  // Acknowledging and extending
  'Perfect, that makes sense. I\'ll make a note of that. Is there anything else you need from my side before we proceed?',

  'I appreciate the clarification! That\'s really helpful. Let me know if anything changes on your end.',

  'Thanks for the update. I\'ll keep that in mind going forward. Feel free to reach out if you need anything else!',

  // Casual continuations
  'Sounds good! I\'ll follow up with you later this week if that works. Hope you have a great rest of your day!',

  'Awesome, thanks for letting me know! I\'ll touch base again soon. Take care!',

  'Great, glad we\'re on the same page. Let\'s keep the momentum going. Talk to you soon!',

  // Professional wrap-ups
  'Noted, thank you! I\'ll make sure to keep you in the loop on any developments. Looking forward to our continued collaboration.',

  'Perfect, I think we have a good plan. I\'ll send over any relevant updates as they come in.',

  'Sounds like a plan! I\'ll follow up next week with more details. Thanks again for your time.',

  // Short continuations
  'Makes sense, thanks for explaining. Let\'s catch up again soon.',

  'Got it! I\'ll be in touch. Have a great day!',

  'Perfect. Looking forward to hearing more. Talk soon!',

  'Thanks again! Will keep you posted on my end as well.',
];

// Final thread closer replies - for ending multi-level threads naturally
const WARMUP_THREAD_CLOSERS = [
  'Sounds perfect! Thanks for the great conversation. Looking forward to connecting again soon. Have a wonderful rest of your week!',

  'Glad we could catch up! I think we covered everything for now. Let\'s definitely stay in touch. Take care!',

  'Thanks for taking the time to chat! I feel like we\'re making good progress. Let\'s touch base again next week if that works for you.',

  'Perfect, I think we\'re all set for now. Really appreciate you keeping me in the loop. Talk to you soon!',

  'Great chat! Thanks for all the updates. I\'ll reach out if anything comes up on my end. Have a great one!',

  'Thanks so much! This has been really helpful. Looking forward to our next conversation. Take care!',

  'Wonderful, sounds like we have a plan. Thanks again for your time today. Best wishes!',

  'I think we\'re good for now. Really appreciate you getting back to me. Let\'s keep in touch!',
];

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

    // Pick random subject and body
    const subject = WARMUP_SUBJECTS[Math.floor(Math.random() * WARMUP_SUBJECTS.length)];
    const body = WARMUP_BODIES[Math.floor(Math.random() * WARMUP_BODIES.length)];

    // Send email
    let result: { messageId: string; threadId?: string; conversationId?: string };
    try {
      result = await client.sendEmail({
        to: toInbox.email,
        from: fromInbox.email,
        fromName: fromInbox.from_name ?? undefined,
        subject,
        htmlBody: `<p>${body}</p>`,
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
    const { originalMessageId, toInboxId, fromInboxId, threadId, threadDepth = 1, maxThreadDepth = 1, isNetworkWarmup } = job.data;

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

    // Pick appropriate reply based on thread depth
    let replyBody: string;
    const isLastReply = threadDepth >= maxThreadDepth;

    if (threadDepth === 1) {
      // First reply - use standard replies
      replyBody = WARMUP_REPLIES[Math.floor(Math.random() * WARMUP_REPLIES.length)];
    } else if (isLastReply) {
      // Final reply in thread - use thread closers for natural ending
      replyBody = WARMUP_THREAD_CLOSERS[Math.floor(Math.random() * WARMUP_THREAD_CLOSERS.length)];
    } else {
      // Middle of thread - use continuation replies
      replyBody = WARMUP_THREAD_CONTINUATIONS[Math.floor(Math.random() * WARMUP_THREAD_CONTINUATIONS.length)];
    }

    // Send reply
    let result: { messageId: string; threadId?: string; conversationId?: string };
    try {
      result = await client.sendEmail({
        to: toInbox.email,
        from: fromInbox.email,
        fromName: fromInbox.from_name ?? undefined,
        subject: 'Re: Quick question',
        htmlBody: `<p>${replyBody}</p>`,
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
