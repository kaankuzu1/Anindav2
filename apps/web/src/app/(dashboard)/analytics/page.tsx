'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Mail,
  MousePointerClick,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Users,
  Inbox,
  AlertCircle,
} from 'lucide-react';

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
  };
  rates: {
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
    positiveReplyRate: number;
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

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1) as { data: { team_id: string }[] | null };

      if (!teamMembers || teamMembers.length === 0) {
        setLoading(false);
        return;
      }

      const tid = teamMembers[0].team_id;
      setTeamId(tid);

      await fetchStats(tid);
      setLoading(false);
    }

    fetchData();
  }, [supabase, router]);

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
    const emailsSent = emails?.length ?? 0;
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
      },
      rates: {
        openRate: emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 1000) / 10 : 0,
        clickRate: emailsOpened > 0 ? Math.round((emailsClicked / emailsOpened) * 1000) / 10 : 0,
        replyRate: emailsSent > 0 ? Math.round((repliesReceived / emailsSent) * 1000) / 10 : 0,
        bounceRate: emailsSent > 0 ? Math.round((emailsBounced / emailsSent) * 1000) / 10 : 0,
        positiveReplyRate: repliesReceived > 0 ? Math.round((interestedReplies / repliesReceived) * 1000) / 10 : 0,
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
  };

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
    if (teamId) {
      fetchStats(teamId);
    }
  };

  if (loading) {
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

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{stats?.overview?.emailsSent ?? 0}</p>
              <p className="text-sm text-muted-foreground">Emails Sent</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{stats?.rates?.openRate ?? 0}%</p>
              <p className="text-sm text-muted-foreground">Open Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{stats?.rates?.replyRate ?? 0}%</p>
              <p className="text-sm text-muted-foreground">Reply Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{stats?.rates?.bounceRate ?? 0}%</p>
              <p className="text-sm text-muted-foreground">Bounce Rate</p>
            </div>
          </div>
        </div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Sent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Open Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Reply Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 font-medium text-foreground">{campaign.name}</td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 text-muted-foreground">{campaign.sent_count}</td>
                  <td className="px-6 py-4 text-muted-foreground">{campaign.openRate}%</td>
                  <td className="px-6 py-4 text-muted-foreground">{campaign.replyRate}%</td>
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
    </div>
  );
}
