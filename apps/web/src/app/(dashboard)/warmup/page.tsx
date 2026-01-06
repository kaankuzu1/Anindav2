'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Flame,
  Play,
  Pause,
  Settings,
  TrendingUp,
  Mail,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';

interface InboxWithWarmup {
  id: string;
  email: string;
  provider: string;
  status: string;
  health_score: number;
  warmup_state: {
    id: string;
    enabled: boolean;
    phase: string;
    current_day: number;
    ramp_speed: string;
    target_daily_volume: number;
    sent_today: number;
    received_today: number;
    replied_today: number;
    sent_total: number;
    received_total: number;
    replied_total: number;
  } | null;
}

export default function WarmupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [inboxes, setInboxes] = useState<InboxWithWarmup[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    activeWarmups: 0,
    totalSentToday: 0,
    totalRepliedToday: 0,
    avgReplyRate: 0,
  });

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

      // Fetch inboxes with warmup state
      const { data } = await supabase
        .from('inboxes')
        .select(`
          id,
          email,
          provider,
          status,
          health_score,
          warmup_state(*)
        `)
        .eq('team_id', tid)
        .order('created_at', { ascending: false }) as { data: InboxWithWarmup[] | null };

      setInboxes(data ?? []);

      // Calculate stats
      let activeCount = 0;
      let sentToday = 0;
      let repliedToday = 0;
      let totalSent = 0;
      let totalReplied = 0;

      for (const inbox of data ?? []) {
        const ws = inbox.warmup_state as any;
        if (ws?.enabled) activeCount++;
        sentToday += ws?.sent_today ?? 0;
        repliedToday += ws?.replied_today ?? 0;
        totalSent += ws?.sent_total ?? 0;
        totalReplied += ws?.replied_total ?? 0;
      }

      setStats({
        activeWarmups: activeCount,
        totalSentToday: sentToday,
        totalRepliedToday: repliedToday,
        avgReplyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
      });

      setLoading(false);
    }

    fetchData();
  }, [supabase, router]);

  const toggleWarmup = async (inboxId: string, enable: boolean) => {
    setActionLoading(inboxId);

    try {
      if (enable) {
        // Get current day from existing warmup state to preserve progress when resuming
        const inbox = inboxes.find(i => i.id === inboxId);
        const existingDay = inbox?.warmup_state?.current_day ?? 0;

        await (supabase
          .from('warmup_state') as any)
          .update({
            enabled: true,
            phase: 'ramping',
            started_at: new Date().toISOString(),
            // Only reset to day 1 if this is a fresh start (day 0), otherwise preserve existing day
            current_day: existingDay > 0 ? existingDay : 1,
          })
          .eq('inbox_id', inboxId);

        await (supabase
          .from('inboxes') as any)
          .update({ status: 'warming_up' })
          .eq('id', inboxId);
      } else {
        await (supabase
          .from('warmup_state') as any)
          .update({
            enabled: false,
            phase: 'paused',
          })
          .eq('inbox_id', inboxId);

        await (supabase
          .from('inboxes') as any)
          .update({ status: 'active' })
          .eq('id', inboxId);
      }

      // Refresh data
      const { data } = await supabase
        .from('inboxes')
        .select(`
          id,
          email,
          provider,
          status,
          health_score,
          warmup_state(*)
        `)
        .eq('team_id', teamId ?? '')
        .order('created_at', { ascending: false }) as { data: InboxWithWarmup[] | null };

      setInboxes(data ?? []);
    } catch (error) {
      console.error('Failed to toggle warmup:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'ramping':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300';
      case 'maintaining':
        return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300';
      case 'paused':
        return 'bg-muted text-muted-foreground';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300';
      default:
        return 'bg-muted text-muted-foreground';
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Warm-up</h1>
        <p className="text-muted-foreground">Gradually warm up your inboxes to improve deliverability</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.activeWarmups}</p>
              <p className="text-sm text-muted-foreground">Active Warmups</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalSentToday}</p>
              <p className="text-sm text-muted-foreground">Sent Today</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalRepliedToday}</p>
              <p className="text-sm text-muted-foreground">Replies Today</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.avgReplyRate}%</p>
              <p className="text-sm text-muted-foreground">Avg Reply Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning: Need 2+ inboxes */}
      {inboxes.length === 1 && (
        <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              <p className="font-medium">Connect at least 2 inboxes to enable warmup</p>
              <p className="mt-1">
                Warmup works by sending emails between your connected inboxes. You need at least 2 inboxes connected to the same team for warmup to function properly.
              </p>
              <Link
                href="/inboxes/connect"
                className="inline-flex items-center gap-1 mt-2 text-yellow-900 dark:text-yellow-200 font-medium hover:underline"
              >
                Connect another inbox
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium">How warmup works</p>
            <p className="mt-1">
              Warmup automatically sends and replies to emails between your connected inboxes to build sender reputation.
              Start with new inboxes and gradually increase sending volume to avoid spam filters.
            </p>
          </div>
        </div>
      </div>

      {/* Inbox List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Inbox</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Day</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Today</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Health</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inboxes.map((inbox) => {
              const ws = inbox.warmup_state;
              const replyRate = ws && ws.sent_total > 0
                ? Math.round((ws.replied_total / ws.sent_total) * 100)
                : 0;

              return (
                <tr key={inbox.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        inbox.provider === 'google' ? 'bg-red-100 dark:bg-red-500/20' : 'bg-blue-100 dark:bg-blue-500/20'
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
                  <td className="px-6 py-4">
                    {ws?.enabled ? (
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getPhaseColor(ws.phase)}`}>
                        {ws.phase}
                      </span>
                    ) : (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {ws?.enabled ? `Day ${ws.current_day}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-foreground">{ws?.sent_today ?? 0} sent</p>
                      <p className="text-muted-foreground">{ws?.replied_today ?? 0} replied</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-foreground">{ws?.sent_total ?? 0} sent</p>
                      <p className="text-muted-foreground">{replyRate}% reply rate</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
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
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {ws?.enabled ? (
                        <button
                          onClick={() => toggleWarmup(inbox.id, false)}
                          disabled={actionLoading === inbox.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-500/30 disabled:opacity-50"
                        >
                          <Pause className="w-4 h-4" />
                          Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleWarmup(inbox.id, true)}
                          disabled={actionLoading === inbox.id || inboxes.length < 2}
                          title={inboxes.length < 2 ? 'Connect at least 2 inboxes to enable warmup' : ''}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Play className="w-4 h-4" />
                          Start
                        </button>
                      )}
                      <Link
                        href={`/inboxes/${inbox.id}`}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                      >
                        <Settings className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {inboxes.length === 0 && (
          <div className="text-center py-12">
            <Flame className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No inboxes connected yet</p>
            <Link
              href="/inboxes/connect"
              className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80"
            >
              Connect an inbox to start warming up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
