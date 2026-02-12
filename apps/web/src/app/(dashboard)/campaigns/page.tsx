'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { Plus, Play, Pause, MoreVertical } from 'lucide-react';

export default function CampaignsPage() {
  const supabase = createClient();
  const { teamId, loading: teamLoading } = useTeam();

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    if (teamLoading) return;
    if (!teamId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('team_id', teamId!)
        .order('created_at', { ascending: false });

      setCampaigns(data ?? []);
      setLoading(false);
    }

    fetchData();
  }, [teamId, teamLoading]);

  if (teamLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const displayCampaigns = campaigns;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground">Manage your email campaigns and sequences</p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Campaign
        </Link>
      </div>

      {/* Campaigns List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Campaign
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Leads
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sent
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Open Rate
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Reply Rate
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayCampaigns.map((campaign: any) => {
              const sentCount = campaign.sent_count ?? 0;
              const openedCount = campaign.opened_count ?? 0;
              const repliedCount = campaign.replied_count ?? 0;
              const openRate = sentCount > 0
                ? ((openedCount / sentCount) * 100).toFixed(1)
                : '0';
              const replyRate = sentCount > 0
                ? ((repliedCount / sentCount) * 100).toFixed(1)
                : '0';

              return (
                <tr key={campaign.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-5">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      campaign.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                        : campaign.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300'
                        : campaign.status === 'draft'
                        ? 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
                    }`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-muted-foreground">
                    {(campaign.lead_count ?? 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-5 text-muted-foreground">
                    {(campaign.sent_count ?? 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-5 text-muted-foreground">
                    {openRate}%
                  </td>
                  <td className="px-6 py-5 text-muted-foreground">
                    {replyRate}%
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {campaign.status === 'active' ? (
                        <button className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent">
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button className="p-2 text-muted-foreground hover:text-green-500 rounded-lg hover:bg-accent">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {displayCampaigns.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No campaigns yet</p>
            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80"
            >
              <Plus className="w-5 h-5" />
              Create your first campaign
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
