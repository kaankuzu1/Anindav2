'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { Plus, Mail, Settings, Flame, AlertCircle, CheckCircle, WifiOff, RefreshCw, ShieldAlert } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';

interface InboxData {
  id: string;
  email: string;
  provider: string;
  status: string;
  status_reason?: string | null;
  health_score: number;
  sent_today: number;
  warmup_state: {
    enabled: boolean;
    current_day: number;
  } | null;
  inbox_settings: {
    daily_send_limit: number;
  } | null;
  spam_complaints_total: number;
}

export default function InboxesPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const supabase = createClient();
  const { teamId, loading: teamLoading, accessToken } = useTeam();

  const [loading, setLoading] = useState(true);
  const [inboxes, setInboxes] = useState<InboxData[]>([]);
  const [checkingConnection, setCheckingConnection] = useState<string | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  useEffect(() => {
    if (teamLoading) return;
    if (!teamId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      const { data } = await supabase
        .from('inboxes')
        .select('*, inbox_settings(*), warmup_state(*)')
        .eq('team_id', teamId!)
        .order('created_at', { ascending: false });

      setInboxes((data as InboxData[]) ?? []);
      setLoading(false);
    }

    fetchData();
  }, [teamId, teamLoading]);

  const isDisconnected = (inbox: InboxData) =>
    inbox.status === 'error' && inbox.status_reason?.includes('disconnected');

  const handleCheckConnection = async (inboxId: string) => {
    if (!teamId || !accessToken) return;
    setCheckingConnection(inboxId);

    try {
      const res = await fetch(`${apiUrl}/inboxes/${inboxId}/check-connection?team_id=${teamId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        // Refresh inbox data
        const { data } = await supabase
          .from('inboxes')
          .select('*, inbox_settings(*), warmup_state(*)')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false });

        setInboxes((data as InboxData[]) ?? []);
      }
    } catch (err) {
      console.error('Failed to check connection:', err);
    } finally {
      setCheckingConnection(null);
    }
  };

  const disconnectedCount = inboxes.filter(isDisconnected).length;
  const spamTotal = inboxes.reduce((acc, i) => acc + (i.spam_complaints_total || 0), 0);

  if (teamLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error messages */}
      {success && (
        <div className="p-4 bg-green-500/10 dark:bg-green-500/20 border border-green-500/30 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-green-800 dark:text-green-300">
            {success === 'connected' && 'Email account connected successfully!'}
            {success === 'reconnected' && 'Email account reconnected successfully!'}
          </p>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-red-800 dark:text-red-300">Failed to connect: {error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inboxes</h1>
          <p className="text-muted-foreground">Manage your connected email accounts</p>
        </div>
        <Link
          href="/inboxes/connect"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Connect Inbox
        </Link>
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-1 gap-4 ${disconnectedCount > 0 || spamTotal > 0 ? (disconnectedCount > 0 && spamTotal > 0 ? 'md:grid-cols-6' : 'md:grid-cols-5') : 'md:grid-cols-4'}`}>
        <StatCard
          label="Active"
          value={inboxes.filter((i) => i.status === 'active').length}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
          className="p-4"
        />
        <StatCard
          label="Warming Up"
          value={inboxes.filter((i) => i.warmup_state?.enabled).length}
          icon={<Flame className="w-5 h-5" />}
          color="orange"
          className="p-4"
        />
        <StatCard
          label="Sent Today"
          value={inboxes.reduce((acc, i) => acc + (i.sent_today || 0), 0)}
          icon={<Mail className="w-5 h-5" />}
          color="blue"
          className="p-4"
        />
        <StatCard
          label="Avg Health"
          value={inboxes.length > 0 ? Math.round(inboxes.reduce((acc, i) => acc + (i.health_score || 0), 0) / inboxes.length) : 0}
          icon={<AlertCircle className="w-5 h-5" />}
          color="purple"
          className="p-4"
        />
        {disconnectedCount > 0 && (
          <StatCard
            label="Disconnected"
            value={disconnectedCount}
            icon={<WifiOff className="w-5 h-5" />}
            color="pink"
            className="p-4"
          />
        )}
        {spamTotal > 0 && (
          <StatCard
            label="Spam Reports"
            value={spamTotal}
            icon={<ShieldAlert className="w-5 h-5" />}
            color="pink"
            className="p-4"
          />
        )}
      </div>

      {/* Inboxes List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Inbox
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Health
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Warm-up
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sent Today
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Spam
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inboxes.map((inbox) => (
              <tr key={inbox.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      inbox.provider === 'google' ? 'bg-red-500/10 dark:bg-red-500/20' : 'bg-blue-500/10 dark:bg-blue-500/20'
                    }`}>
                      <Mail className={`w-5 h-5 ${
                        inbox.provider === 'google' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{inbox.email}</p>
                      <p className="text-sm text-muted-foreground capitalize">{inbox.provider}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  {isDisconnected(inbox) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-900 text-white dark:bg-red-900/80 dark:text-red-200">
                      <WifiOff className="w-3 h-3" />
                      DISCONNECTED
                    </span>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      inbox.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                        : inbox.status === 'warming_up'
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300'
                        : inbox.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
                    }`}>
                      {inbox.status.replace('_', ' ')}
                    </span>
                  )}
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          inbox.health_score >= 80
                            ? 'bg-green-500'
                            : inbox.health_score >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${inbox.health_score}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">{inbox.health_score}</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  {inbox.warmup_state?.enabled ? (
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                      <span className="text-sm text-muted-foreground">
                        Day {inbox.warmup_state.current_day}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground/60">Disabled</span>
                  )}
                </td>
                <td className="px-6 py-5">
                  <span className="text-muted-foreground">
                    {inbox.sent_today} / {inbox.inbox_settings?.daily_send_limit ?? 50}
                  </span>
                </td>
                <td className="px-6 py-5">
                  {inbox.spam_complaints_total > 0 ? (
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                      <ShieldAlert className="w-4 h-4" />
                      {inbox.spam_complaints_total}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">0</span>
                  )}
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleCheckConnection(inbox.id)}
                      disabled={checkingConnection === inbox.id}
                      className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent disabled:opacity-50"
                      title="Check connection"
                    >
                      <RefreshCw className={`w-4 h-4 ${checkingConnection === inbox.id ? 'animate-spin' : ''}`} />
                    </button>
                    <Link
                      href={`/inboxes/${inbox.id}`}
                      className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent inline-block"
                    >
                      <Settings className="w-4 h-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {inboxes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No inboxes connected yet</p>
            <Link
              href="/inboxes/connect"
              className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80"
            >
              <Plus className="w-5 h-5" />
              Connect your first inbox
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
