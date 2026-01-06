import { Worker, Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GmailClient } from '@aninda/email-client';
import { calculateWarmupQuota, decrypt, randomDelay } from '@aninda/shared';

interface WarmupSendJob {
  fromInboxId: string;
  toInboxId: string;
}

interface WarmupReplyJob {
  originalMessageId: string;
  toInboxId: string;
  fromInboxId: string;
  threadId: string;
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
      }
    );

    // Worker for replying to warmup emails
    this.replyWorker = new Worker<WarmupReplyJob>(
      'warmup-reply',
      async (job) => this.processReplyJob(job),
      {
        connection: this.redis,
        concurrency: 3,
      }
    );

    this.sendWorker.on('completed', (job) => {
      console.log(`Warmup send job ${job.id} completed`);
    });

    this.sendWorker.on('error', (err) => {
      if (!err.message.includes('ECONNRESET')) {
        console.error('Warmup send worker error:', err.message);
      }
    });

    this.replyWorker.on('completed', (job) => {
      console.log(`Warmup reply job ${job.id} completed`);
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

  private async processSendJob(job: Job<WarmupSendJob>) {
    const { fromInboxId, toInboxId } = job.data;

    // Get both inboxes
    const { data: fromInbox } = await this.supabase
      .from('inboxes')
      .select('*')
      .eq('id', fromInboxId)
      .single();

    const { data: toInbox } = await this.supabase
      .from('inboxes')
      .select('*')
      .eq('id', toInboxId)
      .single();

    if (!fromInbox || !toInbox) {
      throw new Error('Inbox not found');
    }

    // Decrypt credentials (handle both encrypted and plain tokens)
    let accessToken: string;
    let refreshToken: string;

    try {
      // Try to decrypt (new format: iv:authTag:encrypted)
      if (fromInbox.oauth_access_token!.includes(':')) {
        accessToken = decrypt(fromInbox.oauth_access_token!, this.encryptionKey);
        refreshToken = decrypt(fromInbox.oauth_refresh_token!, this.encryptionKey);
      } else {
        // Plain tokens (legacy)
        accessToken = fromInbox.oauth_access_token!;
        refreshToken = fromInbox.oauth_refresh_token!;
      }
    } catch (e) {
      // Fallback to plain tokens if decryption fails
      accessToken = fromInbox.oauth_access_token!;
      refreshToken = fromInbox.oauth_refresh_token!;
    }

    // Create Gmail client
    const gmailClient = new GmailClient(
      { accessToken, refreshToken },
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
    );

    // Pick random subject and body
    const subject = WARMUP_SUBJECTS[Math.floor(Math.random() * WARMUP_SUBJECTS.length)];
    const body = WARMUP_BODIES[Math.floor(Math.random() * WARMUP_BODIES.length)];

    // Send email
    const result = await gmailClient.sendEmail({
      to: toInbox.email,
      from: fromInbox.email,
      fromName: fromInbox.from_name ?? undefined,
      subject,
      htmlBody: `<p>${body}</p>`,
    });

    // Log interaction
    await this.supabase
      .from('warmup_interactions')
      .insert({
        from_inbox_id: fromInboxId,
        to_inbox_id: toInboxId,
        interaction_type: 'sent',
        message_id: result.messageId,
        thread_id: result.threadId,
        subject,
      });

    // Fetch current warmup state (counters are in warmup_state, not inboxes)
    const { data: warmupState } = await this.supabase
      .from('warmup_state')
      .select('sent_today, sent_total')
      .eq('inbox_id', fromInboxId)
      .single();

    // Update warmup state with correct values
    await this.supabase
      .from('warmup_state')
      .update({
        sent_today: (warmupState?.sent_today ?? 0) + 1,
        sent_total: (warmupState?.sent_total ?? 0) + 1,
        last_activity_at: new Date().toISOString(),
      })
      .eq('inbox_id', fromInboxId);

    // Schedule reply with random delay (2-30 minutes)
    const delay = randomDelay(2 * 60 * 1000, 30 * 60 * 1000);

    await this.warmupQueue.add(
      'warmup-reply',
      {
        originalMessageId: result.messageId,
        toInboxId: fromInboxId,
        fromInboxId: toInboxId,
        threadId: result.threadId,
      } as WarmupReplyJob,
      { delay }
    );

    return { messageId: result.messageId };
  }

  private async processReplyJob(job: Job<WarmupReplyJob>) {
    const { originalMessageId, toInboxId, fromInboxId, threadId } = job.data;

    // Get inbox
    const { data: inbox } = await this.supabase
      .from('inboxes')
      .select('*')
      .eq('id', fromInboxId)
      .single();

    if (!inbox) {
      throw new Error('Inbox not found');
    }

    // Decrypt credentials (handle both encrypted and plain tokens)
    let accessToken: string;
    let refreshToken: string;

    try {
      if (inbox.oauth_access_token!.includes(':')) {
        accessToken = decrypt(inbox.oauth_access_token!, this.encryptionKey);
        refreshToken = decrypt(inbox.oauth_refresh_token!, this.encryptionKey);
      } else {
        accessToken = inbox.oauth_access_token!;
        refreshToken = inbox.oauth_refresh_token!;
      }
    } catch (e) {
      accessToken = inbox.oauth_access_token!;
      refreshToken = inbox.oauth_refresh_token!;
    }

    // Create Gmail client
    const gmailClient = new GmailClient(
      { accessToken, refreshToken },
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
    );

    // Mark original as read and starred (engagement signals)
    await gmailClient.markAsRead(originalMessageId);
    await gmailClient.addStar(originalMessageId);

    // Pick random reply
    const replyBody = WARMUP_REPLIES[Math.floor(Math.random() * WARMUP_REPLIES.length)];

    // Get target inbox email
    const { data: toInbox } = await this.supabase
      .from('inboxes')
      .select('email')
      .eq('id', toInboxId)
      .single();

    // Send reply
    const result = await gmailClient.sendEmail({
      to: toInbox!.email,
      from: inbox.email,
      fromName: inbox.from_name ?? undefined,
      subject: 'Re: Quick question',
      htmlBody: `<p>${replyBody}</p>`,
      inReplyTo: originalMessageId,
      references: originalMessageId,
    });

    // Log interaction
    await this.supabase
      .from('warmup_interactions')
      .insert({
        from_inbox_id: fromInboxId,
        to_inbox_id: toInboxId,
        interaction_type: 'replied',
        message_id: result.messageId,
        thread_id: threadId,
      });

    // Fetch current warmup state (counters are in warmup_state, not inboxes)
    const { data: warmupState } = await this.supabase
      .from('warmup_state')
      .select('replied_today, replied_total')
      .eq('inbox_id', fromInboxId)
      .single();

    // Update warmup state with correct values
    await this.supabase
      .from('warmup_state')
      .update({
        replied_today: (warmupState?.replied_today ?? 0) + 1,
        replied_total: (warmupState?.replied_total ?? 0) + 1,
        last_activity_at: new Date().toISOString(),
      })
      .eq('inbox_id', fromInboxId);

    return { messageId: result.messageId };
  }
}
