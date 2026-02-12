import { Injectable, Inject, NotFoundException } from '@nestjs/common';
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

    // Get spam events
    const { data: spamEvents } = await this.supabase
      .from('email_events')
      .select('id')
      .eq('team_id', teamId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('event_type', 'spam_reported');

    const emailsSpamReported = spamEvents?.length ?? 0;
    const spamRate = emailsSent > 0 ? (emailsSpamReported / emailsSent) * 100 : 0;

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
        emailsSpamReported,
      },
      rates: {
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
        replyRate: Math.round(replyRate * 10) / 10,
        bounceRate: Math.round(bounceRate * 10) / 10,
        positiveReplyRate: Math.round(positiveReplyRate * 10) / 10,
        spamRate: Math.round(spamRate * 10) / 10,
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
    // Verify campaign belongs to team
    const { data: campaign } = await this.supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('team_id', teamId)
      .single();

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

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

  /**
   * Get time-to-reply aggregation metrics
   */
  async getTimeToReplyStats(teamId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get replies with their original email sent_at
    const { data: replies, error } = await this.supabase
      .from('replies')
      .select('received_at, email_id, emails!inner(sent_at, campaign_id)')
      .eq('team_id', teamId)
      .gte('received_at', startDate.toISOString());

    if (error) throw error;

    const replyTimes: number[] = [];
    const byCampaign: Record<string, number[]> = {};

    for (const reply of replies ?? []) {
      const email = reply.emails as any;
      if (email?.sent_at && reply.received_at) {
        const sentAt = new Date(email.sent_at).getTime();
        const receivedAt = new Date(reply.received_at).getTime();
        const replyTimeMinutes = (receivedAt - sentAt) / (1000 * 60);

        if (replyTimeMinutes > 0 && replyTimeMinutes < 60 * 24 * 30) { // Filter outliers
          replyTimes.push(replyTimeMinutes);

          if (email.campaign_id) {
            if (!byCampaign[email.campaign_id]) {
              byCampaign[email.campaign_id] = [];
            }
            byCampaign[email.campaign_id].push(replyTimeMinutes);
          }
        }
      }
    }

    const calculateStats = (times: number[]) => {
      if (times.length === 0) return { avg: 0, median: 0, min: 0, max: 0, count: 0 };
      const sorted = [...times].sort((a, b) => a - b);
      return {
        avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        median: Math.round(sorted[Math.floor(sorted.length / 2)]),
        min: Math.round(sorted[0]),
        max: Math.round(sorted[sorted.length - 1]),
        count: times.length,
      };
    };

    const overallStats = calculateStats(replyTimes);
    const campaignStats: Record<string, ReturnType<typeof calculateStats>> = {};
    for (const [campaignId, times] of Object.entries(byCampaign)) {
      campaignStats[campaignId] = calculateStats(times);
    }

    // Categorize by time buckets
    const buckets = {
      under1Hour: replyTimes.filter(t => t < 60).length,
      under4Hours: replyTimes.filter(t => t >= 60 && t < 240).length,
      under24Hours: replyTimes.filter(t => t >= 240 && t < 1440).length,
      under1Week: replyTimes.filter(t => t >= 1440 && t < 10080).length,
      over1Week: replyTimes.filter(t => t >= 10080).length,
    };

    return {
      overall: {
        ...overallStats,
        avgHours: Math.round(overallStats.avg / 60 * 10) / 10,
        medianHours: Math.round(overallStats.median / 60 * 10) / 10,
      },
      buckets,
      byCampaign: campaignStats,
    };
  }

  /**
   * Detect velocity anomalies in email sending
   */
  async detectVelocityAnomalies(teamId: string, inboxId?: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let query = this.supabase
      .from('emails')
      .select('sent_at, inbox_id')
      .eq('team_id', teamId)
      .gte('sent_at', last7d.toISOString())
      .eq('status', 'sent');

    if (inboxId) {
      query = query.eq('inbox_id', inboxId);
    }

    const { data: emails, error } = await query;

    if (error) throw error;

    // Calculate hourly velocity for the past week
    const hourlyVelocity: Record<string, number> = {};
    for (const email of emails ?? []) {
      const hour = new Date(email.sent_at).toISOString().slice(0, 13);
      hourlyVelocity[hour] = (hourlyVelocity[hour] ?? 0) + 1;
    }

    const velocities = Object.values(hourlyVelocity);
    if (velocities.length < 24) {
      return { anomalies: [], normalRange: { min: 0, max: 0, avg: 0 } };
    }

    // Calculate statistics (excluding last 24h for baseline)
    const historicalVelocities = Object.entries(hourlyVelocity)
      .filter(([hour]) => new Date(hour) < last24h)
      .map(([, count]) => count);

    const avg = historicalVelocities.reduce((a, b) => a + b, 0) / historicalVelocities.length;
    const stdDev = Math.sqrt(
      historicalVelocities.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / historicalVelocities.length
    );

    const normalMin = Math.max(0, avg - 2 * stdDev);
    const normalMax = avg + 2 * stdDev;

    // Find anomalies in last 24h
    const anomalies: Array<{ hour: string; count: number; expectedRange: [number, number]; severity: 'warning' | 'critical' }> = [];

    const recentHours = Object.entries(hourlyVelocity)
      .filter(([hour]) => new Date(hour) >= last24h);

    for (const [hour, count] of recentHours) {
      if (count > normalMax * 2) {
        anomalies.push({
          hour,
          count,
          expectedRange: [Math.round(normalMin), Math.round(normalMax)],
          severity: 'critical',
        });
      } else if (count > normalMax) {
        anomalies.push({
          hour,
          count,
          expectedRange: [Math.round(normalMin), Math.round(normalMax)],
          severity: 'warning',
        });
      }
    }

    return {
      anomalies,
      normalRange: {
        min: Math.round(normalMin),
        max: Math.round(normalMax),
        avg: Math.round(avg),
      },
      recentVelocity: recentHours.map(([hour, count]) => ({ hour, count })),
    };
  }

  /**
   * Get bounce rate by recipient domain
   */
  async getBounceRateByDomain(teamId: string, days = 30, limit = 20) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: emails, error } = await this.supabase
      .from('emails')
      .select('to_email, status')
      .eq('team_id', teamId)
      .gte('sent_at', startDate.toISOString())
      .in('status', ['sent', 'bounced']);

    if (error) throw error;

    // Extract domain and count
    const domainStats: Record<string, { sent: number; bounced: number }> = {};

    for (const email of emails ?? []) {
      const domain = email.to_email?.split('@')[1]?.toLowerCase();
      if (!domain) continue;

      if (!domainStats[domain]) {
        domainStats[domain] = { sent: 0, bounced: 0 };
      }

      domainStats[domain].sent++;
      if (email.status === 'bounced') {
        domainStats[domain].bounced++;
      }
    }

    // Calculate rates and sort by total sent
    const domainList = Object.entries(domainStats)
      .map(([domain, stats]) => ({
        domain,
        sent: stats.sent,
        bounced: stats.bounced,
        bounceRate: stats.sent > 0 ? Math.round((stats.bounced / stats.sent) * 1000) / 10 : 0,
        riskLevel: stats.sent >= 10
          ? (stats.bounced / stats.sent) > 0.1 ? 'high' : (stats.bounced / stats.sent) > 0.05 ? 'medium' : 'low'
          : 'unknown',
      }))
      .sort((a, b) => b.sent - a.sent)
      .slice(0, limit);

    // Calculate problematic domains (high bounce rate with significant volume)
    const problematicDomains = domainList.filter(
      d => d.riskLevel === 'high' && d.sent >= 10
    );

    return {
      domains: domainList,
      problematicDomains,
      summary: {
        totalDomains: Object.keys(domainStats).length,
        problematicCount: problematicDomains.length,
        avgBounceRate: domainList.length > 0
          ? Math.round(domainList.reduce((sum, d) => sum + d.bounceRate, 0) / domainList.length * 10) / 10
          : 0,
      },
    };
  }
}
