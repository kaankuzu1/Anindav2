'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import {
  Mail,
  MousePointerClick,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Users,
  Inbox,
  AlertCircle,
  Clock,
  BarChart3,
  PieChart,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  RefreshCw,
  FlaskConical,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { HourlyDistributionChart } from '@/components/analytics/hourly-distribution-chart';
import { IntentBreakdownChart } from '@/components/analytics/intent-breakdown-chart';

interface DashboardStats {
  overview: {
    emailsSent: number;
    emailsDelivered: number;
    emailsOpened: number;
    emailsClicked: number;
    emailsBounced: number;
    repliesReceived: number;
    interestedReplies: number;
    totalLeads: number;
    activeInboxes: number;
    emailsSpamReported: number;
  };
  rates: {
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
    positiveReplyRate: number;
    spamRate: number;
  };
  health: {
    avgHealthScore: number;
    activeInboxes: number;
    totalInboxes: number;
  };
}

interface CampaignStats {
  id: string;
  name: string;
  status: string;
  sent_count: number;
  opened_count: number;
  replied_count: number;
  openRate: number;
  replyRate: number;
}

interface HourlyData {
  hour: number;
  sent: number;
  opened: number;
  replied: number;
}

interface ReplyBreakdown {
  intent: string;
  count: number;
  percentage: number;
}

interface SpamCampaign {
  campaignId: string;
  campaignName: string;
  spamCount: number;
  sentCount: number;
  spamRate: number;
  inboxBreakdown: { inboxId: string; inboxEmail: string; spamCount: number }[];
}

interface SpamData {
  totalSpam: number;
  spamRate: number;
  byCampaign: SpamCampaign[];
}

export default function AnalyticsPage() {
  const supabase = createClient();
  const { teamId, loading: teamLoading } = useTeam();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [timeRange, setTimeRange] = useState('7d');
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [replyBreakdown, setReplyBreakdown] = useState<ReplyBreakdown[]>([]);
  const [spamData, setSpamData] = useState<SpamData | null>(null);
  const [expandedSpamCampaign, setExpandedSpamCampaign] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'emails' | 'replies' | 'ab_tests'>('overview');

  useEffect(() => {
    if (teamLoading) return;
    if (!teamId) {
      setLoading(false);
      return;
    }

    fetchStats(teamId).then(() => setLoading(false));
  }, [teamId, teamLoading]);

  useEffect(() => {
    if (teamId) {
      fetchStats(teamId);
    }
  }, [timeRange]);

  const fetchStats = async (tid: string) => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch emails
    const { data: emails } = await supabase
      .from('emails')
      .select('status, open_count, click_count')
      .eq('team_id', tid)
      .gte('sent_at', startDate.toISOString()) as { data: { status: string; open_count: number | null; click_count: number | null }[] | null };

    // Fetch replies
    const { data: replies } = await supabase
      .from('replies')
      .select('intent')
      .eq('team_id', tid)
      .gte('received_at', startDate.toISOString()) as { data: { intent: string | null }[] | null };

    // Fetch leads count
    const { count: leadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', tid);

    // Fetch inboxes
    const { data: inboxes } = await supabase
      .from('inboxes')
      .select('status, health_score')
      .eq('team_id', tid) as { data: { status: string; health_score: number | null }[] | null };

    // Calculate stats
    const emailsSent = emails?.filter(e =>
      ['sent', 'delivered', 'opened', 'clicked', 'bounced'].includes(e.status)
    ).length ?? 0;
    const emailsDelivered = emails?.filter((e) => e.status !== 'bounced' && e.status !== 'failed').length ?? 0;
    const emailsOpened = emails?.filter((e) => (e.open_count ?? 0) > 0).length ?? 0;
    const emailsClicked = emails?.filter((e) => (e.click_count ?? 0) > 0).length ?? 0;
    const emailsBounced = emails?.filter((e) => e.status === 'bounced').length ?? 0;
    const repliesReceived = replies?.length ?? 0;
    const interestedReplies = replies?.filter((r) => r.intent === 'interested' || r.intent === 'meeting_request').length ?? 0;
    const activeInboxes = inboxes?.filter((i) => i.status === 'active').length ?? 0;
    const avgHealthScore = inboxes && inboxes.length > 0
      ? Math.round(inboxes.reduce((acc, i) => acc + (i.health_score ?? 0), 0) / inboxes.length)
      : 0;

    // Fetch spam events (email_events table not in generated types yet)
    const { data: spamEvents } = await supabase
      .from('email_events' as any)
      .select('email_id, created_at')
      .eq('team_id', tid)
      .gte('created_at', startDate.toISOString())
      .eq('event_type', 'spam_reported') as { data: { email_id: string; created_at: string }[] | null };

    const emailsSpamReported = spamEvents?.length ?? 0;

    setStats({
      overview: {
        emailsSent,
        emailsDelivered,
        emailsOpened,
        emailsClicked,
        emailsBounced,
        repliesReceived,
        interestedReplies,
        totalLeads: leadCount ?? 0,
        activeInboxes,
        emailsSpamReported,
      },
      rates: {
        openRate: emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 1000) / 10 : 0,
        clickRate: emailsOpened > 0 ? Math.round((emailsClicked / emailsOpened) * 1000) / 10 : 0,
        replyRate: emailsSent > 0 ? Math.round((repliesReceived / emailsSent) * 1000) / 10 : 0,
        bounceRate: emailsSent > 0 ? Math.round((emailsBounced / emailsSent) * 1000) / 10 : 0,
        positiveReplyRate: repliesReceived > 0 ? Math.round((interestedReplies / repliesReceived) * 1000) / 10 : 0,
        spamRate: emailsSent > 0 ? Math.round((emailsSpamReported / emailsSent) * 1000) / 10 : 0,
      },
      health: {
        avgHealthScore,
        activeInboxes,
        totalInboxes: inboxes?.length ?? 0,
      },
    });

    // Fetch campaigns
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('id, name, status, sent_count, opened_count, replied_count')
      .eq('team_id', tid)
      .order('created_at', { ascending: false })
      .limit(10) as { data: { id: string; name: string; status: string; sent_count: number; opened_count: number; replied_count: number }[] | null };

    setCampaigns((campaignData ?? []).map((c) => ({
      ...c,
      openRate: c.sent_count > 0 ? Math.round((c.opened_count / c.sent_count) * 1000) / 10 : 0,
      replyRate: c.sent_count > 0 ? Math.round((c.replied_count / c.sent_count) * 1000) / 10 : 0,
    })));

    // Generate hourly distribution data
    const { data: emailsWithTime } = await supabase
      .from('emails')
      .select('sent_at, open_count')
      .eq('team_id', tid)
      .gte('sent_at', startDate.toISOString()) as { data: { sent_at: string; open_count: number | null }[] | null };

    const { data: repliesWithTime } = await supabase
      .from('replies')
      .select('received_at')
      .eq('team_id', tid)
      .gte('received_at', startDate.toISOString()) as { data: { received_at: string }[] | null };

    // Calculate hourly distribution
    const hourlyStats: { [hour: number]: { sent: number; opened: number; replied: number } } = {};
    for (let h = 0; h < 24; h++) {
      hourlyStats[h] = { sent: 0, opened: 0, replied: 0 };
    }

    emailsWithTime?.forEach((email) => {
      const hour = new Date(email.sent_at).getHours();
      hourlyStats[hour].sent++;
      if ((email.open_count ?? 0) > 0) {
        hourlyStats[hour].opened++;
      }
    });

    repliesWithTime?.forEach((reply) => {
      const hour = new Date(reply.received_at).getHours();
      hourlyStats[hour].replied++;
    });

    setHourlyData(
      Object.entries(hourlyStats).map(([hour, data]) => ({
        hour: parseInt(hour),
        ...data,
      }))
    );

    // Calculate reply intent breakdown
    const intentCounts: { [intent: string]: number } = {};
    replies?.forEach((r) => {
      const intent = r.intent || 'unknown';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });

    const totalReplies = replies?.length ?? 0;
    setReplyBreakdown(
      Object.entries(intentCounts)
        .map(([intent, count]) => ({
          intent,
          count,
          percentage: totalReplies > 0 ? Math.round((count / totalReplies) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count)
    );

    // Fetch spam email details for breakdown
    const spamEmailIds = (spamEvents ?? []).map(e => e.email_id).filter(Boolean);
    let spamByCampaign: SpamCampaign[] = [];

    if (spamEmailIds.length > 0) {
      const { data: spamEmails } = await supabase
        .from('emails')
        .select('id, campaign_id, inbox_id')
        .in('id', spamEmailIds) as { data: { id: string; campaign_id: string | null; inbox_id: string }[] | null };

      // Group by campaign
      const campaignMap = new Map<string, { spamCount: number; inboxes: Map<string, number> }>();
      for (const email of spamEmails ?? []) {
        const cid = email.campaign_id || 'unknown';
        if (!campaignMap.has(cid)) {
          campaignMap.set(cid, { spamCount: 0, inboxes: new Map() });
        }
        const entry = campaignMap.get(cid)!;
        entry.spamCount++;
        const inboxCount = entry.inboxes.get(email.inbox_id) ?? 0;
        entry.inboxes.set(email.inbox_id, inboxCount + 1);
      }

      // Get campaign names
      const campaignIds = Array.from(campaignMap.keys()).filter(id => id !== 'unknown');
      const { data: campaignNames } = (campaignIds.length > 0
        ? await supabase.from('campaigns').select('id, name, sent_count').in('id', campaignIds)
        : { data: [] }) as { data: { id: string; name: string; sent_count: number }[] | null };

      // Get inbox emails
      const allInboxIds = new Set<string>();
      campaignMap.forEach(v => v.inboxes.forEach((_, k) => allInboxIds.add(k)));
      const { data: inboxEmails } = (allInboxIds.size > 0
        ? await supabase.from('inboxes').select('id, email').in('id', Array.from(allInboxIds))
        : { data: [] }) as { data: { id: string; email: string }[] | null };

      const campaignNameMap = new Map((campaignNames ?? []).map(c => [c.id, { name: c.name, sent: c.sent_count }]));
      const inboxEmailMap = new Map((inboxEmails ?? []).map(i => [i.id, i.email]));

      spamByCampaign = Array.from(campaignMap.entries()).map(([cid, data]) => ({
        campaignId: cid,
        campaignName: campaignNameMap.get(cid)?.name ?? 'Unknown Campaign',
        spamCount: data.spamCount,
        sentCount: campaignNameMap.get(cid)?.sent ?? 0,
        spamRate: (campaignNameMap.get(cid)?.sent ?? 0) > 0
          ? Math.round((data.spamCount / (campaignNameMap.get(cid)?.sent ?? 1)) * 1000) / 10
          : 0,
        inboxBreakdown: Array.from(data.inboxes.entries()).map(([iid, count]) => ({
          inboxId: iid,
          inboxEmail: inboxEmailMap.get(iid) ?? 'Unknown',
          spamCount: count,
        })),
      })).sort((a, b) => b.spamCount - a.spamCount);
    }

    setSpamData({
      totalSpam: emailsSpamReported,
      spamRate: emailsSent > 0 ? Math.round((emailsSpamReported / emailsSent) * 1000) / 10 : 0,
      byCampaign: spamByCampaign,
    });

  };

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };

  if (teamLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">Track your email outreach performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {['7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === range ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'emails', label: 'Emails', icon: Mail },
          { id: 'replies', label: 'Replies', icon: MessageSquare },
          { id: 'ab_tests', label: 'A/B Tests', icon: FlaskConical },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              label="Emails Sent"
              value={stats?.overview?.emailsSent ?? 0}
              icon={<Mail className="w-6 h-6" />}
              color="blue"
            />
            <StatCard
              label="Open Rate"
              value={`${stats?.rates?.openRate ?? 0}%`}
              icon={<TrendingUp className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              label="Reply Rate"
              value={`${stats?.rates?.replyRate ?? 0}%`}
              icon={<MessageSquare className="w-6 h-6" />}
              color="purple"
            />
            <StatCard
              label="Bounce Rate"
              value={`${stats?.rates?.bounceRate ?? 0}%`}
              icon={<AlertCircle className="w-6 h-6" />}
              color="orange"
            />
          </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Email Funnel</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sent</span>
              <span className="font-semibold text-foreground">{stats?.overview?.emailsSent ?? 0}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: '100%' }}></div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Delivered</span>
              <span className="font-semibold text-foreground">{stats?.overview?.emailsDelivered ?? 0}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{
                  width: `${stats?.overview?.emailsSent ? ((stats.overview?.emailsDelivered ?? 0) / stats.overview.emailsSent) * 100 : 0}%`,
                }}
              ></div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Opened</span>
              <span className="font-semibold text-foreground">{stats?.overview?.emailsOpened ?? 0}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="h-2 rounded-full bg-purple-500"
                style={{
                  width: `${stats?.overview?.emailsSent ? ((stats.overview?.emailsOpened ?? 0) / stats.overview.emailsSent) * 100 : 0}%`,
                }}
              ></div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Replied</span>
              <span className="font-semibold text-foreground">{stats?.overview?.repliesReceived ?? 0}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="h-2 rounded-full bg-orange-500"
                style={{
                  width: `${stats?.overview?.emailsSent ? ((stats.overview?.repliesReceived ?? 0) / stats.overview.emailsSent) * 100 : 0}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Health */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Account Health</h2>
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-32 h-32 mx-auto relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    strokeWidth="12"
                    fill="none"
                    className="stroke-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    strokeWidth="12"
                    fill="none"
                    stroke={(stats?.health?.avgHealthScore ?? 0) >= 80 ? '#22c55e' : (stats?.health?.avgHealthScore ?? 0) >= 50 ? '#eab308' : '#ef4444'}
                    strokeDasharray={`${(stats?.health?.avgHealthScore ?? 0) * 3.52} 352`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-foreground">{stats?.health?.avgHealthScore ?? 0}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Average Health Score</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{stats?.health?.activeInboxes ?? 0}</p>
                <p className="text-sm text-muted-foreground">Active Inboxes</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{stats?.overview?.totalLeads ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Performance */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Campaign Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Campaign</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Sent</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Open Rate</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Reply Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-5 font-medium text-foreground">{campaign.name}</td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      campaign.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                        : campaign.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-muted-foreground">{campaign.sent_count}</td>
                  <td className="px-6 py-5 text-muted-foreground">{campaign.openRate}%</td>
                  <td className="px-6 py-5 text-muted-foreground">{campaign.replyRate}%</td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No campaigns found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Emails Tab - Detailed Email Analytics */}
      {activeTab === 'emails' && (
        <>
          {/* Email Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <StatCard
              label="Sent"
              value={stats?.overview?.emailsSent ?? 0}
              icon={<Mail className="w-5 h-5" />}
              color="blue"
              className="p-4"
            />
            <StatCard
              label="Delivered"
              value={stats?.overview?.emailsDelivered ?? 0}
              icon={<TrendingUp className="w-5 h-5" />}
              color="green"
              className="p-4"
            />
            <StatCard
              label="Opened"
              value={stats?.overview?.emailsOpened ?? 0}
              icon={<MousePointerClick className="w-5 h-5" />}
              color="purple"
              className="p-4"
            />
            <StatCard
              label="Clicked"
              value={stats?.overview?.emailsClicked ?? 0}
              icon={<MousePointerClick className="w-5 h-5" />}
              color="pink"
              className="p-4"
            />
            <StatCard
              label="Bounced"
              value={stats?.overview?.emailsBounced ?? 0}
              icon={<AlertCircle className="w-5 h-5" />}
              color="orange"
              className="p-4"
            />
            <StatCard
              label="Spam"
              value={stats?.overview?.emailsSpamReported ?? 0}
              icon={<ShieldAlert className="w-5 h-5" />}
              color="pink"
              className="p-4"
            />
          </div>

          {/* Hourly Distribution Chart */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Hourly Distribution</h2>
            </div>

            {/* Recharts Chart */}
            <HourlyDistributionChart data={hourlyData} />

            <p className="text-xs text-muted-foreground text-center mt-4">
              Best time to send: {hourlyData.reduce((best, curr) => curr.opened > best.opened ? curr : best, hourlyData[0])?.hour}:00 (highest open rate)
            </p>
          </div>

          {/* Rate Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-4xl font-bold text-green-600 dark:text-green-400">{stats?.rates?.openRate ?? 0}%</p>
              <p className="text-sm text-muted-foreground mt-1">Open Rate</p>
              <div className="w-full bg-muted rounded-full h-2 mt-3">
                <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.min(stats?.rates?.openRate ?? 0, 100)}%` }}></div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-4xl font-bold text-cyan-600 dark:text-cyan-400">{stats?.rates?.clickRate ?? 0}%</p>
              <p className="text-sm text-muted-foreground mt-1">Click Rate</p>
              <div className="w-full bg-muted rounded-full h-2 mt-3">
                <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.min(stats?.rates?.clickRate ?? 0, 100)}%` }}></div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">{stats?.rates?.replyRate ?? 0}%</p>
              <p className="text-sm text-muted-foreground mt-1">Reply Rate</p>
              <div className="w-full bg-muted rounded-full h-2 mt-3">
                <div className="h-2 rounded-full bg-purple-500" style={{ width: `${Math.min(stats?.rates?.replyRate ?? 0, 100)}%` }}></div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-4xl font-bold text-red-600 dark:text-red-400">{stats?.rates?.bounceRate ?? 0}%</p>
              <p className="text-sm text-muted-foreground mt-1">Bounce Rate</p>
              <div className="w-full bg-muted rounded-full h-2 mt-3">
                <div className="h-2 rounded-full bg-red-500" style={{ width: `${Math.min(stats?.rates?.bounceRate ?? 0, 100)}%` }}></div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">{stats?.rates?.spamRate ?? 0}%</p>
              <p className="text-sm text-muted-foreground mt-1">Spam Rate</p>
              <div className="w-full bg-muted rounded-full h-2 mt-3">
                <div className="h-2 rounded-full bg-orange-500" style={{ width: `${Math.min((stats?.rates?.spamRate ?? 0) * 10, 100)}%` }}></div>
              </div>
            </div>
          </div>

          {/* Spam Reports by Campaign */}
          {(spamData?.totalSpam ?? 0) > 0 && (
            <div className="bg-card rounded-xl border border-border">
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Spam Reports by Campaign</h2>
                    <p className="text-sm text-muted-foreground">{spamData?.totalSpam} total spam reports ({spamData?.spamRate}% of sent)</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Campaign</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Sent</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Spam</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Spam Rate</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {spamData?.byCampaign.map((campaign) => (
                      <React.Fragment key={campaign.campaignId}>
                        <tr
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedSpamCampaign(
                            expandedSpamCampaign === campaign.campaignId ? null : campaign.campaignId
                          )}
                        >
                          <td className="px-6 py-4 font-medium text-foreground">{campaign.campaignName}</td>
                          <td className="px-6 py-4 text-right text-muted-foreground">{campaign.sentCount}</td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-red-600 dark:text-red-400 font-medium">{campaign.spamCount}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-medium ${campaign.spamRate > 1 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                              {campaign.spamRate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${
                              expandedSpamCampaign === campaign.campaignId ? 'rotate-180' : ''
                            }`} />
                          </td>
                        </tr>
                        {expandedSpamCampaign === campaign.campaignId && (
                          <tr>
                            <td colSpan={5} className="px-6 py-3 bg-muted/20">
                              <div className="space-y-2">
                                {campaign.inboxBreakdown.map((inbox) => (
                                  <div key={inbox.inboxId} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      Sent from <span className="font-medium text-foreground">{inbox.inboxEmail}</span>
                                    </span>
                                    <span className="text-red-600 dark:text-red-400 font-medium">
                                      {inbox.spamCount} spam report{inbox.spamCount !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Replies Tab */}
      {activeTab === 'replies' && (
        <>
          {/* Reply Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Total Replies"
              value={stats?.overview?.repliesReceived ?? 0}
              icon={<MessageSquare className="w-6 h-6" />}
              color="purple"
            />
            <StatCard
              label="Interested"
              value={stats?.overview?.interestedReplies ?? 0}
              icon={<ThumbsUp className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              label="Positive Rate"
              value={`${stats?.rates?.positiveReplyRate ?? 0}%`}
              icon={<TrendingUp className="w-6 h-6" />}
              color="blue"
            />
          </div>

          {/* Reply Intent Breakdown */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <PieChart className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Reply Intent Breakdown</h2>
            </div>

            {replyBreakdown.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No replies in this time period</p>
              </div>
            ) : (
              <IntentBreakdownChart data={replyBreakdown} />
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 dark:from-green-500/10 dark:to-emerald-500/10 rounded-xl border border-green-500/20 p-6">
            <h3 className="font-semibold text-foreground mb-3">Reply Management</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {stats?.overview?.interestedReplies ?? 0} interested leads are waiting for your response.
            </p>
            <a
              href="/unibox"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <MessageSquare className="w-4 h-4" />
              View All Replies
            </a>
          </div>
        </>
      )}

      {/* A/B Tests Tab */}
      {activeTab === 'ab_tests' && (
        <ABTestsTab teamId={teamId} supabase={supabase} />
      )}
    </div>
  );
}

function ABTestsTab({ teamId, supabase }: { teamId: string | null; supabase: any }) {
  const [loading, setLoading] = useState(true);
  const [activeTests, setActiveTests] = useState<any[]>([]);
  const [completedTests, setCompletedTests] = useState<any[]>([]);

  useEffect(() => {
    if (!teamId) return;
    fetchABTests();
  }, [teamId]);

  const fetchABTests = async () => {
    if (!teamId) return;
    setLoading(true);

    // Fetch sequences with 2+ variants, joined with campaigns
    const { data: sequences } = await supabase
      .from('sequences')
      .select(`
        id,
        step_number,
        subject,
        campaign_id,
        campaigns!inner(id, name, status, team_id),
        sequence_variants(*)
      `)
      .eq('campaigns.team_id', teamId);

    const withVariants = (sequences || []).filter(
      (s: any) => s.sequence_variants && s.sequence_variants.length >= 2
    );

    const active: any[] = [];
    const completed: any[] = [];

    for (const seq of withVariants) {
      const hasWinner = seq.sequence_variants.some((v: any) => v.is_winner);
      const item = {
        sequenceId: seq.id,
        stepNumber: seq.step_number,
        subject: seq.subject,
        campaignId: seq.campaign_id,
        campaignName: seq.campaigns?.name || 'Unknown',
        campaignStatus: seq.campaigns?.status || 'unknown',
        variants: seq.sequence_variants.map((v: any) => ({
          id: v.id,
          name: v.variant_name || `Variant ${v.variant_index}`,
          weight: v.weight,
          sentCount: v.sent_count || 0,
          openedCount: v.opened_count || 0,
          clickedCount: v.clicked_count || 0,
          repliedCount: v.replied_count || 0,
          isWinner: v.is_winner || false,
          openRate: v.sent_count > 0 ? Math.round((v.opened_count / v.sent_count) * 1000) / 10 : 0,
          replyRate: v.sent_count > 0 ? Math.round((v.replied_count / v.sent_count) * 1000) / 10 : 0,
        })),
        hasWinner,
      };

      if (hasWinner) {
        completed.push(item);
      } else {
        active.push(item);
      }
    }

    setActiveTests(active);
    setCompletedTests(completed);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalTests = activeTests.length + completedTests.length;

  return (
    <>
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total A/B Tests"
          value={totalTests}
          icon={<FlaskConical className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          label="Active Tests"
          value={activeTests.length}
          icon={<RefreshCw className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          label="Completed Tests"
          value={completedTests.length}
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
        />
      </div>

      {/* Active Tests */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Active Tests</h2>
          <p className="text-sm text-muted-foreground">Tests still collecting data</p>
        </div>
        <div className="divide-y divide-border">
          {activeTests.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No active A/B tests</p>
            </div>
          ) : (
            activeTests.map((test) => (
              <div key={test.sequenceId} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-foreground">{test.campaignName}</h3>
                    <p className="text-sm text-muted-foreground">Step {test.stepNumber}: {test.subject}</p>
                  </div>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    test.campaignStatus === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {test.campaignStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {test.variants.map((v: any, i: number) => {
                    const colors = ['border-blue-300 dark:border-blue-500/30', 'border-green-300 dark:border-green-500/30', 'border-orange-300 dark:border-orange-500/30', 'border-pink-300 dark:border-pink-500/30'];
                    return (
                      <div key={v.id} className={`p-3 rounded-lg border ${colors[i % 4]} bg-card`}>
                        <p className="text-sm font-medium text-foreground">{v.name}</p>
                        <p className="text-xs text-muted-foreground">{v.weight}% traffic</p>
                        <div className="mt-2 space-y-1 text-xs">
                          <p><span className="text-muted-foreground">Sent:</span> <span className="font-medium text-foreground">{v.sentCount}</span></p>
                          <p><span className="text-muted-foreground">Open:</span> <span className="font-medium text-foreground">{v.openRate}%</span></p>
                          <p><span className="text-muted-foreground">Reply:</span> <span className="font-medium text-foreground">{v.replyRate}%</span></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Completed Tests */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Completed Tests</h2>
          <p className="text-sm text-muted-foreground">Tests with declared winners</p>
        </div>
        <div className="divide-y divide-border">
          {completedTests.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <p>No completed A/B tests yet</p>
            </div>
          ) : (
            completedTests.map((test) => {
              const winner = test.variants.find((v: any) => v.isWinner);
              return (
                <div key={test.sequenceId} className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-foreground">{test.campaignName}</h3>
                      <p className="text-sm text-muted-foreground">Step {test.stepNumber}</p>
                    </div>
                    {winner && (
                      <span className="inline-flex items-center gap-1 text-sm bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 px-3 py-1 rounded-full">
                        Winner: {winner.name}
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-2 font-medium">Variant</th>
                          <th className="pb-2 font-medium text-right">Sent</th>
                          <th className="pb-2 font-medium text-right">Open Rate</th>
                          <th className="pb-2 font-medium text-right">Reply Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {test.variants.map((v: any) => (
                          <tr key={v.id} className="border-b border-border/50">
                            <td className="py-2 font-medium text-foreground">
                              {v.name} {v.isWinner && '\u{1F3C6}'}
                            </td>
                            <td className="py-2 text-right text-muted-foreground">{v.sentCount}</td>
                            <td className="py-2 text-right text-muted-foreground">{v.openRate}%</td>
                            <td className="py-2 text-right text-muted-foreground">{v.replyRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
