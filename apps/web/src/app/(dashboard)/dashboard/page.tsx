import { createClient } from '@/lib/supabase/server';
import { Mail, Users, Inbox, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';
import AIDailySummary from '@/components/ai/DailySummary';

export default async function DashboardPage() {
  const supabase = createClient();

  // Get user and team
  const { data: { user } } = await supabase.auth.getUser();
  let teamId: string | null = null;

  if (user) {
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .limit(1) as { data: { team_id: string }[] | null };

    if (teamMembers && teamMembers.length > 0) {
      teamId = teamMembers[0].team_id;
    }
  }

  // Fetch real data
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Emails sent in last 7 days
  const { count: emailsSent } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId ?? '')
    .gte('sent_at', sevenDaysAgo.toISOString());

  // Active inboxes
  const { count: activeInboxes } = await supabase
    .from('inboxes')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId ?? '')
    .eq('status', 'active');

  // Total leads
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId ?? '');

  // Replies in last 7 days
  const { count: repliesCount } = await supabase
    .from('replies')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId ?? '')
    .gte('received_at', sevenDaysAgo.toISOString());

  // Recent campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('team_id', teamId ?? '')
    .order('created_at', { ascending: false })
    .limit(5) as { data: { id: string; name: string; status: string; sent_count: number; replied_count: number }[] | null };

  // Inbox health
  const { data: inboxes } = await supabase
    .from('inboxes')
    .select('status, health_score')
    .eq('team_id', teamId ?? '') as { data: { status: string; health_score: number | null }[] | null };

  const healthyInboxes = inboxes?.filter((i) => (i.health_score ?? 0) >= 80).length ?? 0;
  const warningInboxes = inboxes?.filter((i) => (i.health_score ?? 0) >= 50 && (i.health_score ?? 0) < 80).length ?? 0;
  const criticalInboxes = inboxes?.filter((i) => (i.health_score ?? 0) < 50).length ?? 0;

  const stats = [
    {
      name: 'Emails Sent (7d)',
      value: (emailsSent ?? 0).toLocaleString(),
      change: '',
      trend: 'up',
      icon: Mail,
    },
    {
      name: 'Active Inboxes',
      value: String(activeInboxes ?? 0),
      change: '',
      trend: 'up',
      icon: Inbox,
    },
    {
      name: 'Total Leads',
      value: (totalLeads ?? 0).toLocaleString(),
      change: '',
      trend: 'up',
      icon: Users,
    },
    {
      name: 'Replies (7d)',
      value: String(repliesCount ?? 0),
      change: '',
      trend: 'up',
      icon: MessageSquare,
    },
  ];

  const recentCampaigns = (campaigns ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    sent: c.sent_count ?? 0,
    replied: c.replied_count ?? 0,
    replyRate: c.sent_count > 0 ? `${Math.round((c.replied_count / c.sent_count) * 100 * 10) / 10}%` : '0%',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your email outreach performance</p>
      </div>

      {/* AI Daily Summary */}
      <AIDailySummary />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
              <span className={`flex items-center text-sm font-medium ${
                stat.trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {stat.trend === 'up' ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 mr-1" />
                )}
                {stat.change}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
              <p className="text-sm text-muted-foreground">{stat.name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/campaigns/new"
          className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary hover:shadow-sm transition-all"
        >
          <div className="w-12 h-12 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Create Campaign</h3>
            <p className="text-sm text-muted-foreground">Start a new email sequence</p>
          </div>
        </a>

        <a
          href="/inboxes/connect"
          className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary hover:shadow-sm transition-all"
        >
          <div className="w-12 h-12 bg-green-500/10 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
            <Inbox className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Connect Inbox</h3>
            <p className="text-sm text-muted-foreground">Add Gmail or Outlook</p>
          </div>
        </a>

        <a
          href="/leads/import"
          className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary hover:shadow-sm transition-all"
        >
          <div className="w-12 h-12 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Import Leads</h3>
            <p className="text-sm text-muted-foreground">Upload CSV or add manually</p>
          </div>
        </a>
      </div>

      {/* Recent Campaigns */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Campaigns</h2>
            <a href="/campaigns" className="text-sm text-primary hover:text-primary/80">
              View all
            </a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Replies
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Reply Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentCampaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <a href={`/campaigns/${campaign.id}`} className="font-medium text-foreground hover:text-primary">
                      {campaign.name}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      campaign.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300'
                    }`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {campaign.sent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {campaign.replied}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {campaign.replyRate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inbox Health */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Inbox Health</h2>
            <a href="/inboxes" className="text-sm text-primary hover:text-primary/80">
              Manage inboxes
            </a>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 dark:bg-green-500/20 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-green-600 dark:text-green-400">{healthyInboxes}</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Healthy</p>
                <p className="text-sm text-muted-foreground">Score 80+</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-500/10 dark:bg-yellow-500/20 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{warningInboxes}</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Warning</p>
                <p className="text-sm text-muted-foreground">Score 50-79</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500/10 dark:bg-red-500/20 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-red-600 dark:text-red-400">{criticalInboxes}</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Critical</p>
                <p className="text-sm text-muted-foreground">Score below 50</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
