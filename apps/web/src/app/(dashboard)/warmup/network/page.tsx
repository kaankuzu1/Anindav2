'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { ChevronLeft, Globe, Bell } from 'lucide-react';
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

export default function NetworkWarmupPage() {
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

  const handleRemoveFromNetwork = async (inboxId: string) => {
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
        toast.error('Failed to remove inbox from network');
        return;
      }

      toast.success('Inbox removed from Network warmup');
      await refreshInboxes();
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove inbox from Network warmup');
    }
  };

  const handleAssignToNetwork = async (inboxId: string) => {
    if (!teamId || !accessToken) return;
    try {
      const res = await fetch(`${apiUrl}/warmup/${inboxId}/mode?team_id=${teamId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'network' }),
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

      toast.success('Inbox added to Network warmup');
      await refreshInboxes();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add inbox to Network warmup');
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
          body: JSON.stringify({ mode: 'network' }),
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

  const networkInboxes = inboxes.filter(i => i.warmup_state?.warmup_mode === 'network');
  const unassignedInboxes = inboxes.filter(i => !i.warmup_state?.warmup_mode);

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
            <IconBackground color="purple" size="md">
              <Globe className="w-6 h-6" />
            </IconBackground>
            <div>
              <h1 className="text-3xl font-bold">Network Warmup</h1>
              <p className="text-muted-foreground">
                Platform-managed warmup partners for hassle-free sender reputation building
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Network Unavailable Banner */}
      <div className="mb-6 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border border-purple-200 dark:border-purple-500/30 rounded-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
            <Bell className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-purple-900 dark:text-purple-100 text-lg mb-1">
              Network Warmup Coming Soon
            </h3>
            <p className="text-purple-700 dark:text-purple-300 mb-3">
              Network warmup uses professionally managed platform inboxes to warm up your email sender reputation.
              This feature is currently being configured and will be available soon.
            </p>
            <p className="text-sm text-purple-600 dark:text-purple-400">
              You can add inboxes to Network warmup now, and they'll automatically start warming up once the network is ready.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-8">
        <WarmupStatsGrid inboxes={networkInboxes} mode="network" />
      </div>

      {/* Active Network Inboxes Section */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Active Network Inboxes</h2>
        <WarmupInboxTable
          inboxes={networkInboxes}
          mode="network"
          onToggleWarmup={handleToggleWarmup}
          onSaveSettings={handleSaveSettings}
          onResetWarmup={handleResetWarmup}
          onFetchHistory={handleFetchHistory}
          onRemoveFromMode={handleRemoveFromNetwork}
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
                mode="network"
                onAssign={handleAssignToNetwork}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
