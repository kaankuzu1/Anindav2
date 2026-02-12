import { Injectable, Inject, NotFoundException, BadRequestException, BadGatewayException, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { GmailClient } from '@aninda/email-client';
import { MicrosoftClient } from '@aninda/email-client';
import { decrypt, encrypt, processEmailContent } from '@aninda/shared';

type IntentType = 'interested' | 'meeting_request' | 'question' | 'not_interested' | 'unsubscribe' | 'out_of_office' | 'auto_reply' | 'bounce' | 'neutral';

interface GetRepliesOptions {
  inbox_id?: string;
  campaign_id?: string;
  intent?: IntentType;
  is_read?: boolean;
  is_archived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class RepliesService {
  private readonly logger = new Logger(RepliesService.name);
  private encryptionKey: string;
  private googleClientId: string;
  private googleClientSecret: string;
  private microsoftClientId: string;
  private microsoftClientSecret: string;

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.getOrThrow<string>('ENCRYPTION_KEY');
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    this.microsoftClientId = this.configService.get<string>('MICROSOFT_CLIENT_ID') ?? '';
    this.microsoftClientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET') ?? '';
  }

  async getReplies(teamId: string, options?: GetRepliesOptions) {
    let query = this.supabase
      .from('replies')
      .select(`
        *,
        leads(id, email, first_name, last_name, company),
        inboxes(id, email, provider),
        campaigns(id, name)
      `, { count: 'exact' })
      .eq('team_id', teamId)
      .order('received_at', { ascending: false });

    if (options?.inbox_id) {
      query = query.eq('inbox_id', options.inbox_id);
    }

    if (options?.campaign_id) {
      query = query.eq('campaign_id', options.campaign_id);
    }

    if (options?.intent) {
      query = query.eq('intent', options.intent);
    }

    if (options?.is_read !== undefined) {
      query = query.eq('is_read', options.is_read);
    }

    if (options?.is_archived !== undefined) {
      query = query.eq('is_archived', options.is_archived);
    }

    if (options?.search) {
      query = query.or(
        `from_email.ilike.%${options.search}%,from_name.ilike.%${options.search}%,subject.ilike.%${options.search}%,body_preview.ilike.%${options.search}%`,
      );
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { data, count };
  }

  async getReply(replyId: string, teamId: string) {
    const { data, error } = await this.supabase
      .from('replies')
      .select(`
        *,
        leads(id, email, first_name, last_name, company, title, phone, custom_fields),
        inboxes(id, email, provider),
        campaigns(id, name),
        emails(id, subject, body_html, sent_at)
      `)
      .eq('id', replyId)
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Reply not found');
    }

    return data;
  }

  async markAsRead(replyId: string, teamId: string) {
    await this.getReply(replyId, teamId);

    const { data, error } = await this.supabase
      .from('replies')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', replyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markAsUnread(replyId: string, teamId: string) {
    await this.getReply(replyId, teamId);

    const { data, error } = await this.supabase
      .from('replies')
      .update({
        is_read: false,
        read_at: null,
      })
      .eq('id', replyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async archive(replyId: string, teamId: string) {
    await this.getReply(replyId, teamId);

    const { data, error } = await this.supabase
      .from('replies')
      .update({ is_archived: true })
      .eq('id', replyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async unarchive(replyId: string, teamId: string) {
    await this.getReply(replyId, teamId);

    const { data, error } = await this.supabase
      .from('replies')
      .update({ is_archived: false })
      .eq('id', replyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateIntent(replyId: string, teamId: string, intent: IntentType) {
    await this.getReply(replyId, teamId);

    const { data, error } = await this.supabase
      .from('replies')
      .update({
        intent,
        intent_manual_override: true,
      })
      .eq('id', replyId)
      .select()
      .single();

    if (error) throw error;

    // Update lead status based on intent
    const reply = data;
    if (reply.lead_id) {
      let leadStatus = 'replied';
      if (intent === 'interested' || intent === 'meeting_request') {
        leadStatus = 'interested';
      } else if (intent === 'not_interested' || intent === 'unsubscribe') {
        leadStatus = 'not_interested';
      } else if (intent === 'bounce') {
        leadStatus = 'bounced';
      }

      await this.supabase
        .from('leads')
        .update({
          status: leadStatus,
          reply_intent: intent,
        })
        .eq('id', reply.lead_id);
    }

    return data;
  }

  async bulkMarkAsRead(replyIds: string[], teamId: string) {
    const { error } = await this.supabase
      .from('replies')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('team_id', teamId)
      .in('id', replyIds);

    if (error) throw error;
    return { success: true, updated: replyIds.length };
  }

  async bulkArchive(replyIds: string[], teamId: string) {
    const { error } = await this.supabase
      .from('replies')
      .update({ is_archived: true })
      .eq('team_id', teamId)
      .in('id', replyIds);

    if (error) throw error;
    return { success: true, updated: replyIds.length };
  }

  async getThread(threadId: string, teamId: string) {
    // Get original email
    const { data: emails, error: emailError } = await this.supabase
      .from('emails')
      .select('*')
      .eq('team_id', teamId)
      .eq('thread_id', threadId)
      .order('sent_at', { ascending: true });

    if (emailError) throw emailError;

    // Get replies in thread
    const { data: replies, error: replyError } = await this.supabase
      .from('replies')
      .select('*')
      .eq('team_id', teamId)
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true });

    if (replyError) throw replyError;

    // Merge and sort by date
    const thread = [
      ...(emails ?? []).map((e) => ({
        type: 'sent' as const,
        id: e.id,
        from: e.from_email,
        to: e.to_email,
        subject: e.subject,
        body: e.body_html ?? e.body_text,
        date: e.sent_at,
      })),
      ...(replies ?? []).map((r) => ({
        type: 'received' as const,
        id: r.id,
        from: r.from_email,
        to: r.inbox_id, // Will be resolved by frontend
        subject: r.subject,
        body: r.body_html ?? r.body_text,
        date: r.received_at,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return thread;
  }

  async getUnreadCount(teamId: string) {
    const { count, error } = await this.supabase
      .from('replies')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('is_read', false)
      .eq('is_archived', false);

    if (error) throw error;
    return { count: count ?? 0 };
  }

  async getIntentSummary(teamId: string) {
    const { data, error } = await this.supabase
      .from('replies')
      .select('intent')
      .eq('team_id', teamId)
      .eq('is_archived', false);

    if (error) throw error;

    const summary: Record<string, number> = {
      interested: 0,
      meeting_request: 0,
      question: 0,
      not_interested: 0,
      unsubscribe: 0,
      out_of_office: 0,
      auto_reply: 0,
      bounce: 0,
      neutral: 0,
      unclassified: 0,
    };

    for (const reply of data ?? []) {
      if (reply.intent) {
        summary[reply.intent] = (summary[reply.intent] ?? 0) + 1;
      } else {
        summary.unclassified++;
      }
    }

    return summary;
  }

  /**
   * Send a reply to an incoming email
   */
  async sendReply(
    replyId: string,
    teamId: string,
    content: string,
    inboxId: string,
    subject?: string,
  ): Promise<{ messageId: string; threadId: string; sentAt: Date }> {
    // 1. Fetch the original reply for threading info
    const originalReply = await this.getReply(replyId, teamId);

    // 2. Fetch the inbox and decrypt credentials
    const { data: inbox, error: inboxError } = await this.supabase
      .from('inboxes')
      .select('*')
      .eq('id', inboxId)
      .eq('team_id', teamId)
      .single();

    if (inboxError || !inbox) {
      throw new NotFoundException('Inbox not found');
    }

    // Allow active and warming_up inboxes to send (warming_up can still send at reduced capacity)
    if (inbox.status !== 'active' && inbox.status !== 'warming_up') {
      throw new BadRequestException(`Inbox is ${inbox.status} and cannot send emails`);
    }

    if (!inbox.oauth_access_token || !inbox.oauth_refresh_token) {
      throw new BadRequestException('Inbox credentials not configured');
    }

    // Decrypt credentials
    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = decrypt(inbox.oauth_access_token, this.encryptionKey);
      refreshToken = decrypt(inbox.oauth_refresh_token, this.encryptionKey);
    } catch (err) {
      this.logger.error(`Failed to decrypt credentials for inbox ${inboxId}: ${err}`);
      throw new BadRequestException('Inbox credentials are corrupted or invalid. Please reconnect your email account.');
    }

    // 3. Process variables in content and subject
    const lead = originalReply.leads;
    const variables: Record<string, string> = {
      // Lead variables (both formats)
      firstName: lead?.first_name ?? '',
      lastName: lead?.last_name ?? '',
      first_name: lead?.first_name ?? '',
      last_name: lead?.last_name ?? '',
      email: lead?.email ?? '',
      company: lead?.company ?? '',
      title: lead?.title ?? '',
      phone: lead?.phone ?? '',
      fullName: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(),
      full_name: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(),

      // Inbox variables (both formats)
      from_name: inbox.from_name ?? '',
      from_email: inbox.email ?? '',
      fromName: inbox.from_name ?? '',
      fromEmail: inbox.email ?? '',

      // Sender variables (both formats) — matches email-sender.ts
      senderFirstName: inbox.sender_first_name ?? '',
      sender_first_name: inbox.sender_first_name ?? '',
      senderLastName: inbox.sender_last_name ?? '',
      sender_last_name: inbox.sender_last_name ?? '',
      senderCompany: inbox.sender_company ?? '',
      sender_company: inbox.sender_company ?? '',
      senderTitle: inbox.sender_title ?? '',
      sender_title: inbox.sender_title ?? '',
      senderPhone: inbox.sender_phone ?? '',
      sender_phone: inbox.sender_phone ?? '',
      senderWebsite: inbox.sender_website ?? '',
      sender_website: inbox.sender_website ?? '',
    };

    // Spread custom_fields from lead into variables
    if (lead?.custom_fields && typeof lead.custom_fields === 'object') {
      for (const [key, value] of Object.entries(lead.custom_fields as Record<string, unknown>)) {
        if (typeof value === 'string') {
          variables[key] = value;
        }
      }
    }

    // Process content with variables
    const processedContent = processEmailContent(content, variables);

    // Process subject with variables (if provided)
    const baseSubject = subject || (originalReply.subject?.startsWith('Re:')
      ? originalReply.subject
      : `Re: ${originalReply.subject || '(No subject)'}`);
    const processedSubject = processEmailContent(baseSubject, variables);

    // Convert HTML content to plain text for fallback
    const textContent = processedContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    let messageId = '';
    let threadId = originalReply.thread_id || '';

    // 4. Validate provider credentials
    if (inbox.provider === 'google' && (!this.googleClientId || !this.googleClientSecret)) {
      this.logger.error('Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured');
      throw new InternalServerErrorException('Email provider is not configured. Please contact support.');
    }
    if (inbox.provider === 'microsoft' && (!this.microsoftClientId || !this.microsoftClientSecret)) {
      this.logger.error('Microsoft OAuth credentials (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET) are not configured');
      throw new InternalServerErrorException('Email provider is not configured. Please contact support.');
    }

    // 5. Send via appropriate email client
    try {
    if (inbox.provider === 'google') {
      const client = new GmailClient(
        {
          accessToken,
          refreshToken,
          expiresAt: inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined,
        },
        this.googleClientId,
        this.googleClientSecret,
      );

      const result = await client.sendEmail({
        to: originalReply.from_email,
        from: inbox.email,
        fromName: inbox.from_name || undefined,
        subject: processedSubject,
        htmlBody: processedContent,
        textBody: textContent,
        inReplyTo: originalReply.message_id || undefined,
        references: originalReply.message_id || undefined,
      });

      messageId = result.messageId;
      threadId = result.threadId;

      // Update inbox credentials if refreshed
      const refreshedCreds = await client.getRefreshedCredentials();
      if (refreshedCreds) {
        await this.updateInboxCredentials(inboxId, refreshedCreds);
      }
    } else if (inbox.provider === 'microsoft') {
      const client = new MicrosoftClient(
        {
          accessToken,
          refreshToken,
          expiresAt: inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined,
        },
        {
          clientId: this.microsoftClientId,
          clientSecret: this.microsoftClientSecret,
          onTokenRefresh: async (newCreds) => {
            await this.updateInboxCredentials(inboxId, newCreds);
          },
        },
      );

      const result = await client.sendEmail({
        to: originalReply.from_email,
        from: inbox.email,
        fromName: inbox.from_name || undefined,
        subject: processedSubject,
        htmlBody: processedContent,
        textBody: textContent,
        inReplyTo: originalReply.message_id || undefined,
        useReplyEndpoint: true,
      });

      messageId = result.messageId;
      threadId = result.conversationId;
    } else {
      throw new BadRequestException(`SMTP sending not yet supported for replies`);
    }
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof BadGatewayException || err instanceof InternalServerErrorException) {
        throw err;
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      const errStr = errMsg.toLowerCase();
      this.logger.error(`Email send failed for inbox ${inboxId} (${inbox.provider}): ${errMsg}`, err instanceof Error ? err.stack : undefined);

      if (errStr.includes('401') || errStr.includes('unauthorized') || errStr.includes('invalid_grant') || errStr.includes('token')) {
        throw new BadGatewayException('Email account authorization has expired. Please reconnect your email account.');
      }
      if (errStr.includes('403') || errStr.includes('forbidden') || errStr.includes('insufficient')) {
        throw new BadGatewayException('Insufficient permissions to send email. Please reconnect your email account with the required scopes.');
      }
      if (errStr.includes('429') || errStr.includes('rate') || errStr.includes('throttl')) {
        throw new BadGatewayException('Rate limit reached for your email provider. Please wait a moment and try again.');
      }

      throw new BadGatewayException('Failed to send email through your email provider. Please try again or reconnect your account.');
    }

    const sentAt = new Date();

    // 6. Log the sent reply to database (with processed variables)
    const { error: insertError } = await this.supabase.from('sent_replies').insert({
      team_id: teamId,
      reply_id: replyId,
      inbox_id: inboxId,
      lead_id: originalReply.lead_id,
      campaign_id: originalReply.campaign_id,
      subject: processedSubject,
      body_html: processedContent,
      body_text: textContent,
      message_id: messageId,
      in_reply_to: originalReply.message_id,
      thread_id: threadId,
      status: 'sent',
      sent_at: sentAt.toISOString(),
    });
    if (insertError) {
      this.logger.warn(`Failed to log sent reply for reply ${replyId}: ${insertError.message}`);
    }

    // 7. Update inbox sent count
    const { error: rpcError } = await this.supabase.rpc('increment_inbox_sent', { inbox_id: inboxId });
    if (rpcError) {
      // Fallback if RPC doesn't exist - update directly
      await this.supabase
        .from('inboxes')
        .update({
          sent_today: (inbox.sent_today ?? 0) + 1,
          sent_total: (inbox.sent_total ?? 0) + 1,
          last_sent_at: sentAt.toISOString(),
        })
        .eq('id', inboxId);
    }

    // 8. Update lead status if needed
    if (originalReply.lead_id) {
      await this.supabase
        .from('leads')
        .update({
          last_contacted_at: sentAt.toISOString(),
        })
        .eq('id', originalReply.lead_id);
    }

    return { messageId, threadId, sentAt };
  }

  /**
   * Update inbox OAuth credentials after token refresh
   */
  private async updateInboxCredentials(
    inboxId: string,
    credentials: { accessToken: string; refreshToken: string; expiresAt?: Date },
  ): Promise<void> {
    await this.supabase
      .from('inboxes')
      .update({
        oauth_access_token: encrypt(credentials.accessToken, this.encryptionKey),
        oauth_refresh_token: encrypt(credentials.refreshToken, this.encryptionKey),
        oauth_expires_at: credentials.expiresAt?.toISOString(),
      })
      .eq('id', inboxId);
  }

  /**
   * Get sent replies for a specific reply
   */
  async getSentReplies(replyId: string, teamId: string) {
    const { data, error } = await this.supabase
      .from('sent_replies')
      .select('*, inboxes(id, email, provider)')
      .eq('reply_id', replyId)
      .eq('team_id', teamId)
      .order('sent_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Get all sent replies for a team (for Unibox Sent view)
   */
  async getAllSentReplies(
    teamId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<any[]> {
    const { limit = 50, offset = 0 } = options;

    const { data, error } = await this.supabase
      .from('sent_replies')
      .select(`
        *,
        inboxes(id, email, provider, from_name),
        leads(id, email, first_name, last_name, company, title),
        campaigns(id, name),
        replies(id, from_email, from_name, subject)
      `)
      .eq('team_id', teamId)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }
}
