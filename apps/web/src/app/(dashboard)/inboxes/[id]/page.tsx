'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Mail,
  Settings,
  Flame,
  Shield,
  Activity,
  AlertCircle,
  CheckCircle,
  Trash2,
} from 'lucide-react';

interface Inbox {
  id: string;
  email: string;
  provider: string;
  status: string;
  health_score: number;
  from_name: string | null;
  daily_send_limit: number;
  created_at: string;
}

interface WarmupState {
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
  started_at: string | null;
  last_activity_at: string | null;
}

interface InboxSettings {
  id: string;
  daily_send_limit: number;
  hourly_send_limit: number | null;
  min_delay_seconds: number;
  max_delay_seconds: number;
}

export default function InboxSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const inboxId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [warmupState, setWarmupState] = useState<WarmupState | null>(null);
  const [settings, setSettings] = useState<InboxSettings | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [fromName, setFromName] = useState('');
  const [dailySendLimit, setDailySendLimit] = useState(50);
  const [rampSpeed, setRampSpeed] = useState('normal');
  const [targetVolume, setTargetVolume] = useState(40);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch inbox
      const { data: inboxData } = await supabase
        .from('inboxes')
        .select('*')
        .eq('id', inboxId)
        .single() as { data: Inbox | null };

      if (!inboxData) {
        router.push('/inboxes');
        return;
      }

      setInbox(inboxData);
      setFromName(inboxData.from_name ?? '');

      // Fetch warmup state
      const { data: warmupData } = await supabase
        .from('warmup_state')
        .select('*')
        .eq('inbox_id', inboxId)
        .single() as { data: WarmupState | null };

      setWarmupState(warmupData);
      if (warmupData) {
        setRampSpeed(warmupData.ramp_speed);
        setTargetVolume(warmupData.target_daily_volume);
      }

      // Fetch inbox settings
      const { data: settingsData } = await supabase
        .from('inbox_settings')
        .select('*')
        .eq('inbox_id', inboxId)
        .single() as { data: InboxSettings | null };

      setSettings(settingsData);
      if (settingsData) {
        setDailySendLimit(settingsData.daily_send_limit);
      }

      setLoading(false);
    }

    fetchData();
  }, [supabase, router, inboxId]);

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Update inbox
      await (supabase
        .from('inboxes') as any)
        .update({ from_name: fromName || null })
        .eq('id', inboxId);

      // Update inbox settings
      await (supabase
        .from('inbox_settings') as any)
        .update({ daily_send_limit: dailySendLimit })
        .eq('inbox_id', inboxId);

      // Update warmup state
      if (warmupState) {
        await (supabase
          .from('warmup_state') as any)
          .update({
            ramp_speed: rampSpeed,
            target_daily_volume: targetVolume,
          })
          .eq('inbox_id', inboxId);
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const disconnectInbox = async () => {
    if (!confirm('Are you sure you want to disconnect this inbox? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete warmup state first (foreign key)
      await (supabase
        .from('warmup_state') as any)
        .delete()
        .eq('inbox_id', inboxId);

      // Delete inbox settings
      await (supabase
        .from('inbox_settings') as any)
        .delete()
        .eq('inbox_id', inboxId);

      // Delete inbox
      await (supabase
        .from('inboxes') as any)
        .delete()
        .eq('id', inboxId);

      router.push('/inboxes');
    } catch (error) {
      console.error('Failed to disconnect inbox:', error);
      setMessage({ type: 'error', text: 'Failed to disconnect inbox. Please try again.' });
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!inbox) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Inbox not found</p>
        <Link href="/inboxes" className="text-primary hover:underline mt-2 inline-block">
          Back to Inboxes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/inboxes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Inboxes
      </Link>

      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
              inbox.provider === 'google' ? 'bg-red-100 dark:bg-red-500/20' : 'bg-blue-100 dark:bg-blue-500/20'
            }`}>
              <Mail className={`w-7 h-7 ${
                inbox.provider === 'google' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
              }`} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{inbox.email}</h1>
              <p className="text-muted-foreground capitalize">{inbox.provider} Account</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
              inbox.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' :
              inbox.status === 'warming_up' ? 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300' :
              'bg-muted text-muted-foreground'
            }`}>
              {inbox.status === 'warming_up' ? 'Warming Up' : inbox.status}
            </span>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30' : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
          <p className={message.type === 'success' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${getHealthColor(inbox.health_score)}`}>
                {inbox.health_score}%
              </p>
              <p className="text-sm text-muted-foreground">Health Score</p>
            </div>
          </div>
          <div className="mt-3 w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getHealthBgColor(inbox.health_score)}`}
              style={{ width: `${inbox.health_score}%` }}
            />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {warmupState?.enabled ? `Day ${warmupState.current_day}` : 'Off'}
              </p>
              <p className="text-sm text-muted-foreground">Warmup Status</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{warmupState?.sent_total ?? 0}</p>
              <p className="text-sm text-muted-foreground">Emails Sent</p>
            </div>
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">General Settings</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              From Name
            </label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="e.g., John Smith"
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-sm text-muted-foreground mt-1">
              The name that will appear in the &quot;From&quot; field of your emails
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Daily Send Limit
            </label>
            <input
              type="number"
              value={dailySendLimit}
              onChange={(e) => setDailySendLimit(parseInt(e.target.value) || 0)}
              min={1}
              max={500}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Maximum number of emails to send per day from this inbox
            </p>
          </div>
        </div>
      </div>

      {/* Warmup Settings */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          <h2 className="text-lg font-semibold text-foreground">Warmup Settings</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Ramp Speed
            </label>
            <select
              value={rampSpeed}
              onChange={(e) => setRampSpeed(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="slow">Slow (0.7x - More conservative)</option>
              <option value="normal">Normal (1x - Recommended)</option>
              <option value="fast">Fast (1.5x - Aggressive)</option>
            </select>
            <p className="text-sm text-muted-foreground mt-1">
              How quickly to increase daily email volume during warmup
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Target Daily Volume
            </label>
            <input
              type="number"
              value={targetVolume}
              onChange={(e) => setTargetVolume(parseInt(e.target.value) || 0)}
              min={10}
              max={100}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Target number of warmup emails per day once fully ramped
            </p>
          </div>

          {warmupState && (
            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <h3 className="text-sm font-medium text-foreground mb-2">Warmup Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Today Sent</p>
                  <p className="font-medium text-foreground">{warmupState.sent_today}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Today Replied</p>
                  <p className="font-medium text-foreground">{warmupState.replied_today}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Sent</p>
                  <p className="font-medium text-foreground">{warmupState.sent_total}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reply Rate</p>
                  <p className="font-medium text-foreground">
                    {warmupState.sent_total > 0
                      ? Math.round((warmupState.replied_total / warmupState.sent_total) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={disconnectInbox}
          className="inline-flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Disconnect Inbox
        </button>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
