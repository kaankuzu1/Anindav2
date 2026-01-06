import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async getDashboardStats(teamId: string, range?: DateRange) {
    const startDate = range?.start ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = range?.end ?? new Date();

    // Get email stats
    const { data: emails, error: emailError } = await this.supabase
      .from('emails')
      .select('status, sent_at, open_count, click_count')
      .eq('team_id', teamId)
      .gte('sent_at', startDate.toISOString())
      .lte('sent_at', endDate.toISOString());

    if (emailError) throw emailError;

    // Get reply stats
    const { data: replies, error: replyError } = await this.supabase
      .from('replies')
      .select('intent, received_at')
      .eq('team_id', teamId)
      .gte('received_at', startDate.toISOString())
      .lte('received_at', endDate.toISOString());

    if (replyError) throw replyError;

    // Get lead stats
    const { count: totalLeads } = await this.supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    // Get inbox stats
    const { data: inboxes } = await this.supabase
      .from('inboxes')
      .select('status, health_score')
      .eq('team_id', teamId);

    // Calculate metrics
    const emailsSent = emails?.length ?? 0;
    const emailsDelivered = emails?.filter((e) => e.status !== 'bounced' && e.status !== 'failed').length ?? 0;
    const emailsOpened = emails?.filter((e) => (e.open_count ?? 0) > 0).length ?? 0;
    const emailsClicked = emails?.filter((e) => (e.click_count ?? 0) > 0).length ?? 0;
    const emailsBounced = emails?.filter((e) => e.status === 'bounced').length ?? 0;

    const repliesReceived = replies?.length ?? 0;
    const interestedReplies = replies?.filter((r) => r.intent === 'interested' || r.intent === 'meeting_request').length ?? 0;

    const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;
    const clickRate = emailsOpened > 0 ? (emailsClicked / emailsOpened) * 100 : 0;
    const replyRate = emailsSent > 0 ? (repliesReceived / emailsSent) * 100 : 0;
    const bounceRate = emailsSent > 0 ? (emailsBounced / emailsSent) * 100 : 0;
    const positiveReplyRate = repliesReceived > 0 ? (interestedReplies / repliesReceived) * 100 : 0;

    const activeInboxes = inboxes?.filter((i) => i.status === 'active').length ?? 0;
    const avgHealthScore = inboxes && inboxes.length > 0
      ? inboxes.reduce((acc, i) => acc + (i.health_score ?? 0), 0) / inboxes.length
      : 0;

    return {
      overview: {
        emailsSent,
        emailsDelivered,
        emailsOpened,
        emailsClicked,
        emailsBounced,
        repliesReceived,
        interestedReplies,
        totalLeads: totalLeads ?? 0,
        activeInboxes,
      },
      rates: {
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
        replyRate: Math.round(replyRate * 10) / 10,
        bounceRate: Math.round(bounceRate * 10) / 10,
        positiveReplyRate: Math.round(positiveReplyRate * 10) / 10,
      },
      health: {
        avgHealthScore: Math.round(avgHealthScore),
        activeInboxes,
        totalInboxes: inboxes?.length ?? 0,
      },
    };
  }

  async getEmailStats(teamId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('emails')
      .select('sent_at, status, open_count, click_count')
      .eq('team_id', teamId)
      .gte('sent_at', startDate.toISOString())
      .order('sent_at', { ascending: true });

    if (error) throw error;

    // Group by day
    const dailyStats: Record<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number }> = {};

    for (const email of data ?? []) {
      const date = new Date(email.sent_at).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
      }
      dailyStats[date].sent++;
      if (email.status !== 'bounced' && email.status !== 'failed') {
        dailyStats[date].delivered++;
      }
      if ((email.open_count ?? 0) > 0) {
        dailyStats[date].opened++;
      }
      if ((email.click_count ?? 0) > 0) {
        dailyStats[date].clicked++;
      }
      if (email.status === 'bounced') {
        dailyStats[date].bounced++;
      }
    }

    return Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }

  async getCampaignStats(teamId: string, campaignId?: string) {
    let query = this.supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        lead_count,
        sent_count,
        delivered_count,
        opened_count,
        clicked_count,
        replied_count,
        bounced_count,
        unsubscribed_count,
        started_at,
        created_at
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (campaignId) {
      query = query.eq('id', campaignId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate rates for each campaign
    return (data ?? []).map((campaign) => ({
      ...campaign,
      openRate: campaign.sent_count > 0 ? Math.round((campaign.opened_count / campaign.sent_count) * 1000) / 10 : 0,
      clickRate: campaign.opened_count > 0 ? Math.round((campaign.clicked_count / campaign.opened_count) * 1000) / 10 : 0,
      replyRate: campaign.sent_count > 0 ? Math.round((campaign.replied_count / campaign.sent_count) * 1000) / 10 : 0,
      bounceRate: campaign.sent_count > 0 ? Math.round((campaign.bounced_count / campaign.sent_count) * 1000) / 10 : 0,
    }));
  }

  async getInboxStats(teamId: string) {
    const { data, error } = await this.supabase
      .from('inboxes')
      .select(`
        id,
        email,
        provider,
        status,
        health_score,
        bounce_rate_7d,
        open_rate_7d,
        reply_rate_7d,
        sent_today,
        sent_this_week,
        sent_total,
        inbox_settings(daily_send_limit),
        warmup_state(enabled, phase, current_day)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getLeadStats(teamId: string) {
    const { data, error } = await this.supabase
      .from('leads')
      .select('status')
      .eq('team_id', teamId);

    if (error) throw error;

    const statusCounts: Record<string, number> = {};
    for (const lead of data ?? []) {
      statusCounts[lead.status] = (statusCounts[lead.status] ?? 0) + 1;
    }

    return {
      total: data?.length ?? 0,
      byStatus: statusCounts,
    };
  }

  async getReplyIntentBreakdown(teamId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('replies')
      .select('intent, received_at')
      .eq('team_id', teamId)
      .gte('received_at', startDate.toISOString());

    if (error) throw error;

    const intentCounts: Record<string, number> = {
      interested: 0,
      meeting_request: 0,
      question: 0,
      not_interested: 0,
      unsubscribe: 0,
      out_of_office: 0,
      auto_reply: 0,
      bounce: 0,
      neutral: 0,
    };

    for (const reply of data ?? []) {
      if (reply.intent) {
        intentCounts[reply.intent] = (intentCounts[reply.intent] ?? 0) + 1;
      }
    }

    return {
      total: data?.length ?? 0,
      byIntent: intentCounts,
    };
  }

  async getSequencePerformance(teamId: string, campaignId: string) {
    const { data, error } = await this.supabase
      .from('sequences')
      .select('step_number, subject, sent_count, opened_count, replied_count')
      .eq('campaign_id', campaignId)
      .order('step_number', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((seq) => ({
      ...seq,
      openRate: seq.sent_count > 0 ? Math.round((seq.opened_count / seq.sent_count) * 1000) / 10 : 0,
      replyRate: seq.sent_count > 0 ? Math.round((seq.replied_count / seq.sent_count) * 1000) / 10 : 0,
    }));
  }

  async getHourlyDistribution(teamId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: emails, error: emailError } = await this.supabase
      .from('emails')
      .select('sent_at, open_count')
      .eq('team_id', teamId)
      .gte('sent_at', startDate.toISOString());

    if (emailError) throw emailError;

    // Group by hour of day
    const hourlyStats: Record<number, { sent: number; opened: number }> = {};
    for (let i = 0; i < 24; i++) {
      hourlyStats[i] = { sent: 0, opened: 0 };
    }

    for (const email of emails ?? []) {
      const hour = new Date(email.sent_at).getHours();
      hourlyStats[hour].sent++;
      if ((email.open_count ?? 0) > 0) {
        hourlyStats[hour].opened++;
      }
    }

    return Object.entries(hourlyStats).map(([hour, stats]) => ({
      hour: parseInt(hour, 10),
      ...stats,
      openRate: stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 1000) / 10 : 0,
    }));
  }
}
