import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

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
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

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
        leads(id, email, first_name, last_name, company, title, phone),
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
}
