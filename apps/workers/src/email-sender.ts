import { Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GmailClient, MicrosoftClient } from '@aninda/email-client';
import { processEmailContent, decrypt } from '@aninda/shared';

interface SendEmailJob {
  emailId: string;
  leadId: string;
  campaignId: string;
  inboxId: string;
  sequenceStep: number;
}

export class EmailSenderWorker {
  private worker: Worker | null = null;
  private encryptionKey: string;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.encryptionKey = process.env.ENCRYPTION_KEY!;
  }

  start() {
    this.worker = new Worker<SendEmailJob>(
      'email-send',
      async (job) => this.processJob(job),
      {
        connection: this.redis,
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 1000,
        },
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Email job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Email job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      // Suppress connection reset errors
      if (!err.message.includes('ECONNRESET')) {
        console.error('Email worker error:', err.message);
      }
    });

    console.log('Email sender worker started');
  }

  async stop() {
    await this.worker?.close();
  }

  private async processJob(job: Job<SendEmailJob>) {
    const { emailId, leadId, inboxId } = job.data;

    // Get email record
    const { data: email, error: emailError } = await this.supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .single();

    if (emailError || !email) {
      throw new Error(`Email not found: ${emailId}`);
    }

    // Get inbox with credentials
    const { data: inbox, error: inboxError } = await this.supabase
      .from('inboxes')
      .select('*')
      .eq('id', inboxId)
      .single();

    if (inboxError || !inbox) {
      throw new Error(`Inbox not found: ${inboxId}`);
    }

    // Get lead for variable injection
    const { data: lead } = await this.supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    // Decrypt credentials
    const accessToken = inbox.oauth_access_token
      ? decrypt(inbox.oauth_access_token, this.encryptionKey)
      : null;
    const refreshToken = inbox.oauth_refresh_token
      ? decrypt(inbox.oauth_refresh_token, this.encryptionKey)
      : null;

    if (!accessToken || !refreshToken) {
      throw new Error('Missing inbox credentials');
    }

    // Process email content with variables
    const variables = {
      firstName: lead?.first_name ?? '',
      lastName: lead?.last_name ?? '',
      email: lead?.email ?? '',
      company: lead?.company ?? '',
      title: lead?.title ?? '',
      ...((lead?.custom_fields as Record<string, string>) ?? {}),
    };

    const processedSubject = processEmailContent(email.subject, variables);
    const processedBody = processEmailContent(email.body_html ?? '', variables);

    // Send email based on provider
    let messageId: string;

    if (inbox.provider === 'google') {
      const gmailClient = new GmailClient(
        { accessToken, refreshToken },
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!
      );

      const result = await gmailClient.sendEmail({
        to: email.to_email,
        from: email.from_email,
        fromName: email.from_name ?? undefined,
        subject: processedSubject,
        htmlBody: processedBody,
      });

      messageId = result.messageId;
    } else if (inbox.provider === 'microsoft') {
      const msClient = new MicrosoftClient({ accessToken, refreshToken });

      const result = await msClient.sendEmail({
        to: email.to_email,
        from: email.from_email,
        fromName: email.from_name ?? undefined,
        subject: processedSubject,
        htmlBody: processedBody,
      });

      messageId = result.messageId;
    } else {
      throw new Error(`Unsupported provider: ${inbox.provider}`);
    }

    // Update email record
    await this.supabase
      .from('emails')
      .update({
        status: 'sent',
        message_id: messageId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', emailId);

    // Update inbox sent count
    await this.supabase
      .from('inboxes')
      .update({
        sent_today: (inbox.sent_today ?? 0) + 1,
        sent_total: (inbox.sent_total ?? 0) + 1,
        last_sent_at: new Date().toISOString(),
      })
      .eq('id', inboxId);

    // Update lead status
    await this.supabase
      .from('leads')
      .update({
        status: 'in_sequence',
        last_contacted_at: new Date().toISOString(),
        first_contacted_at: lead?.first_contacted_at ?? new Date().toISOString(),
      })
      .eq('id', leadId);

    // Log event
    await this.supabase
      .from('email_events')
      .insert({
        team_id: email.team_id,
        email_id: emailId,
        event_type: 'sent',
      });

    return { messageId };
  }
}
