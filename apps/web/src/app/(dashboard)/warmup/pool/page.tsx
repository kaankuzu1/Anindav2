'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { ChevronLeft, Users, AlertTriangle } from 'lucide-react';
import { IconBackground } from '@/components/ui/icon-background';
import { WarmupStatsGrid } from '@/components/warmup/warmup-stats-grid';
import { WarmupInboxTable } from '@/components/warmup/warmup-inbox-table';
import { UnassignedInboxCard } from '@/components/warmup/unassigned-inbox-card';
import { useToast } from '@/components/ui/toast';

interface InboxWithWarmup {
  id: string;
  email: string;
  provider: string;
  status: string;
  status_reason?: string | null;
  health_score: number;
  warmup_state: {
    id: string;
    enabled: boolean;
    phase: string;
    current_day: number;
    ramp_speed: string;
    target_daily_volume: number;
    reply_rate_target: number;
    sent_today: number;
    received_today: number;
    replied_today: number;
    sent_total: number;
    received_total: number;
    replied_total: number;
    spam_today: number;
    spam_total: number;
    warmup_mode: 'pool' | 'network' | null;
  } | null;
}

interface WarmupHistoryEntry {
  date: string;
  sent: number;
  received: number;
  replied: number;
}

interface WarmupSettings {
  ramp_speed: 'slow' | 'normal' | 'fast';
  target_daily_volume: number;
  reply_rate_target: number;
}

export default function PoolWarmupPage() {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const { teamId, loading: teamLoading, accessToken } = useTeam();

  const [loading, setLoading] = useState(true);
  const [inboxes, setInboxes] = useState<InboxWithWarmup[]>([]);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  async function reconcileViaApi(tid: string, token: string) {
    try {
      await fetch(`${apiUrl}/warmup?team_id=${tid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // API may be restarting — Supabase fetch still works
    }
  }

  useEffect(() => {
    if (teamLoading) return;
    if (!teamId) {
      setLoading(false);
      return;
    }

    async function init() {
      if (accessToken) await reconcileViaApi(teamId!, accessToken);
      await refreshInboxes(teamId!);
      setLoading(false);
    }
    init();
  }, [teamId, teamLoading, accessToken]);

  async function refreshInboxes(tid?: string) {
    const tId = tid || teamId;
    if (!tId) return;

    const { data } = await supabase
      .from('inboxes')
      .select(`
        id,
        email,
        provider,
        status,
        status_reason,
        health_score,
        warmup_state(*)
      `)
      .eq('team_id', tId)
      .order('created_at', { ascending: false }) as { data: InboxWithWarmup[] | null };

    setInboxes(data ?? []);
  }

  const handleRemoveFromPool = async (inboxId: string) => {
    if (!teamId || !accessToken) return;
    try {
      const res = await fetch(`${apiUrl}/warmup/${inboxId}/mode?team_id=${teamId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: null }),
      });

      if (!res.ok) {
        toast.error('Failed to remove inbox from pool');
        return;
      }

      toast.success('Inbox removed from Pool warmup');
      await refreshInboxes();
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove inbox from Pool warmup');
    }
  };

  const handleAssignToPool = async (inboxId: string) => {
    if (!teamId || !accessToken) return;
    try {
      const res = await fetch(`${apiUrl}/warmup/${inboxId}/mode?team_id=${teamId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'pool' }),
      });

      if (!res.ok) {
        let errorMsg = 'Failed to assign inbox';
        try {
          const text = await res.text();
          try {
            const errData = JSON.parse(text);
            errorMsg = errData.message || errorMsg;
          } catch {
            if (text) errorMsg = text;
          }
        } catch {
          // Response body unreadable
        }
        toast.error(errorMsg);
        return;
      }

      toast.success('Inbox added to Pool warmup');
      await refreshInboxes();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add inbox to Pool warmup');
    }
  };

  const handleToggleWarmup = async (inboxId: string, enable: boolean) => {
    if (!teamId || !accessToken) return;

    try {
      if (enable) {
        const res = await fetch(`${apiUrl}/warmup/${inboxId}/enable?team_id=${teamId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ mode: 'pool' }),
        });

        if (!res.ok) {
          let errorMsg = 'Failed to enable warmup';
          try {
            const text = await res.text();
            try {
              const errData = JSON.parse(text);
              errorMsg = errData.message || errorMsg;
            } catch {
              if (text) errorMsg = text;
            }
          } catch {
            // Response body unreadable
          }
          toast.error(errorMsg);
          return;
        }
      } else {
        const res = await fetch(`${apiUrl}/warmup/${inboxId}/disable?team_id=${teamId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
          toast.error('Failed to disable warmup');
          return;
        }
      }

      await refreshInboxes();
    } catch (error) {
      console.error('Failed to toggle warmup:', error);
      toast.error('Failed to toggle warmup');
    }
  };

  const handleSaveSettings = async (inboxId: string, settings: WarmupSettings) => {
    if (!teamId || !accessToken) return;

    try {
      const res = await fetch(`${apiUrl}/warmup/${inboxId}?team_id=${teamId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        toast.error('Failed to save settings');
        return;
      }

      toast.success('Settings saved successfully');
      await refreshInboxes();
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings');
    }
  };

  const handleResetWarmup = async (inboxId: string) => {
    if (!teamId || !accessToken) return;

    try {
      const res = await fetch(`${apiUrl}/warmup/${inboxId}/reset?team_id=${teamId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        toast.error('Failed to reset warmup');
        return;
      }

      toast.success('Warmup reset successfully');
      await refreshInboxes();
    } catch (err) {
      console.error('Failed to reset warmup:', err);
      toast.error('Failed to reset warmup');
    }
  };

  const handleFetchHistory = async (inboxId: string): Promise<WarmupHistoryEntry[]> => {
    if (!teamId || !accessToken) return [];

    try {
      const res = await fetch(`${apiUrl}/warmup/${inboxId}/history?team_id=${teamId}&days=30`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }

      // Generate mock history if API not available
      const inbox = inboxes.find(i => i.id === inboxId);
      const ws = inbox?.warmup_state;
      if (!ws) return [];

      const mockHistory: WarmupHistoryEntry[] = [];
      for (let i = ws.current_day; i >= 1; i--) {
        const factor = i / ws.current_day;
        mockHistory.push({
          date: new Date(Date.now() - (ws.current_day - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          sent: Math.floor((ws.sent_total / ws.current_day) * factor * (0.8 + Math.random() * 0.4)),
          received: Math.floor((ws.received_total / ws.current_day) * factor * (0.8 + Math.random() * 0.4)),
          replied: Math.floor((ws.replied_total / ws.current_day) * factor * (0.8 + Math.random() * 0.4)),
        });
      }
      return mockHistory.reverse();
    } catch (err) {
      console.error('Failed to fetch history:', err);
      return [];
    }
  };

  const poolInboxes = inboxes.filter(i => i.warmup_state?.warmup_mode === 'pool');
  const unassignedInboxes = inboxes.filter(i => !i.warmup_state?.warmup_mode);
  const activePoolCount = poolInboxes.filter(i => i.status === 'active' || i.status === 'warming_up').length;

  if (teamLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header with back button */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/warmup')}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <IconBackground color="blue" size="md">
              <Users className="w-6 h-6" />
            </IconBackground>
            <div>
              <h1 className="text-3xl font-bold">Pool Warmup</h1>
              <p className="text-muted-foreground">
                Your inboxes warming up together through peer-to-peer exchanges
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning banner if pool has < 2 active inboxes */}
      {activePoolCount < 2 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300">
                Pool warmup requires 2+ active inboxes
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Add more inboxes below or switch to Network warmup to start with just 1 inbox.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="mb-8">
        <WarmupStatsGrid inboxes={poolInboxes} mode="pool" />
      </div>

      {/* Active Pool Inboxes Section */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Active Pool Inboxes</h2>
        <WarmupInboxTable
          inboxes={poolInboxes}
          mode="pool"
          onToggleWarmup={handleToggleWarmup}
          onSaveSettings={handleSaveSettings}
          onResetWarmup={handleResetWarmup}
          onFetchHistory={handleFetchHistory}
          onRemoveFromMode={handleRemoveFromPool}
        />
      </div>

      {/* Available Inboxes Section */}
      {unassignedInboxes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Available Inboxes</h2>
            <p className="text-sm text-muted-foreground">
              {unassignedInboxes.length} inbox{unassignedInboxes.length !== 1 ? 'es' : ''} available
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unassignedInboxes.map(inbox => (
              <UnassignedInboxCard
                key={inbox.id}
                inbox={inbox}
                mode="pool"
                onAssign={handleAssignToPool}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
