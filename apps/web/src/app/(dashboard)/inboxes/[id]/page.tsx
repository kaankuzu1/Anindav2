'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
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
  RefreshCw,
  XCircle,
  Globe,
  WifiOff,
  User,
} from 'lucide-react';

interface Inbox {
  id: string;
  email: string;
  provider: string;
  status: string;
  status_reason?: string | null;
  health_score: number;
  from_name: string | null;
  daily_send_limit: number;
  sender_first_name: string | null;
  sender_last_name: string | null;
  sender_company: string | null;
  sender_title: string | null;
  sender_phone: string | null;
  sender_website: string | null;
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

const API_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1`;

interface DnsValidation {
  domain: string;
  validation: {
    score: number;
    spf: { valid: boolean; record: string | null };
    dkim: { valid: boolean; selector: string | null; record: string | null };
    dmarc: { valid: boolean; policy: string | null; record: string | null };
    recommendations: string[];
  };
  requirements_met: boolean;
  failures: string[];
}

export default function InboxSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const inboxId = params.id as string;
  const supabase = createClient();

  const { teamId, loading: teamLoading, accessToken } = useTeam();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [warmupState, setWarmupState] = useState<WarmupState | null>(null);
  const [settings, setSettings] = useState<InboxSettings | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dnsValidation, setDnsValidation] = useState<DnsValidation | null>(null);
  const [checkingDns, setCheckingDns] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);

  // Form state
  const [fromName, setFromName] = useState('');
  const [dailySendLimit, setDailySendLimit] = useState(50);
  const [rampSpeed, setRampSpeed] = useState('normal');
  const [targetVolume, setTargetVolume] = useState(40);

  // Sender information state
  const [senderFirstName, setSenderFirstName] = useState('');
  const [senderLastName, setSenderLastName] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [senderTitle, setSenderTitle] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderWebsite, setSenderWebsite] = useState('');

  useEffect(() => {
    if (teamLoading) return;

    async function fetchData() {
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
      setSenderFirstName(inboxData.sender_first_name ?? '');
      setSenderLastName(inboxData.sender_last_name ?? '');
      setSenderCompany(inboxData.sender_company ?? '');
      setSenderTitle(inboxData.sender_title ?? '');
      setSenderPhone(inboxData.sender_phone ?? '');
      setSenderWebsite(inboxData.sender_website ?? '');

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
  }, [teamLoading, inboxId]);

  const loadInbox = async () => {
    const { data: inboxData } = await supabase
      .from('inboxes')
      .select('*')
      .eq('id', inboxId)
      .single() as { data: Inbox | null };

    if (inboxData) {
      setInbox(inboxData);
      setFromName(inboxData.from_name ?? '');
      setSenderFirstName(inboxData.sender_first_name ?? '');
      setSenderLastName(inboxData.sender_last_name ?? '');
      setSenderCompany(inboxData.sender_company ?? '');
      setSenderTitle(inboxData.sender_title ?? '');
      setSenderPhone(inboxData.sender_phone ?? '');
      setSenderWebsite(inboxData.sender_website ?? '');
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Compute from_name from sender first + last name
      const computedFromName = senderFirstName || senderLastName
        ? `${senderFirstName} ${senderLastName}`.trim()
        : fromName || null;

      // 1. Update inbox metadata and inbox_settings via single API call
      const inboxPayload = {
        from_name: computedFromName,
        sender_first_name: senderFirstName || null,
        sender_last_name: senderLastName || null,
        sender_company: senderCompany || null,
        sender_title: senderTitle || null,
        sender_phone: senderPhone || null,
        sender_website: senderWebsite || null,
        daily_send_limit: dailySendLimit,
      };

      const inboxRes = await fetch(
        `${API_URL}/inboxes/${inboxId}?team_id=${teamId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(inboxPayload),
        }
      );

      if (!inboxRes.ok) {
        let errorMsg = 'Failed to save inbox settings';
        try {
          const errorData = await inboxRes.json();
          errorMsg = errorData.message || errorMsg;
        } catch {
          errorMsg = await inboxRes.text().catch(() => errorMsg);
        }
        throw new Error(errorMsg);
      }

      // 2. Update warmup settings if warmup is enabled
      if (warmupState) {
        const warmupPayload = {
          ramp_speed: rampSpeed,
          target_daily_volume: targetVolume,
        };

        const warmupRes = await fetch(
          `${API_URL}/warmup/${inboxId}?team_id=${teamId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(warmupPayload),
          }
        );

        if (!warmupRes.ok) {
          let errorMsg = 'Failed to save warmup settings';
          try {
            const errorData = await warmupRes.json();
            errorMsg = errorData.message || errorMsg;
          } catch {
            errorMsg = await warmupRes.text().catch(() => errorMsg);
          }
          throw new Error(errorMsg);
        }
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });

      // Refresh inbox data to reflect changes
      loadInbox();
    } catch (error) {
      console.error('Failed to save settings:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to save settings. Please try again.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const checkDns = async () => {
    if (!teamId || !inbox) return;

    setCheckingDns(true);
    setMessage(null);

    try {
      const response = await fetch(
        `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1'}/inboxes/${inbox.id}/dns-check?team_id=${teamId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check DNS');
      }

      const result = await response.json();
      setDnsValidation(result);

      if (result.requirements_met) {
        setMessage({ type: 'success', text: 'DNS configuration looks good!' });
      } else {
        setMessage({ type: 'error', text: 'DNS configuration has issues. Check the details below.' });
      }
    } catch (error) {
      console.error('Failed to check DNS:', error);
      setMessage({ type: 'error', text: 'Failed to check DNS configuration. Please try again.' });
    } finally {
      setCheckingDns(false);
    }
  };

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const isDisconnected = inbox?.status === 'error' && inbox?.status_reason?.includes('disconnected');

  const checkConnection = async () => {
    if (!teamId || !inbox || !accessToken) return;
    setCheckingConnection(true);
    setMessage(null);

    try {
      const res = await fetch(`${apiUrl}/inboxes/${inbox.id}/check-connection?team_id=${teamId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let result: any;
      try {
        result = await res.json();
      } catch {
        result = {};
      }

      if (result.connected) {
        setMessage({ type: 'success', text: 'Connection verified successfully!' });
        // Refresh inbox data to clear disconnected state
        const { data: inboxData } = await supabase
          .from('inboxes')
          .select('*')
          .eq('id', inboxId)
          .single() as { data: Inbox | null };
        if (inboxData) setInbox(inboxData);
      } else {
        setMessage({ type: 'error', text: result.error || 'Inbox is disconnected. Please reconnect your email account.' });
        // Refresh inbox data to show disconnected state
        const { data: inboxData } = await supabase
          .from('inboxes')
          .select('*')
          .eq('id', inboxId)
          .single() as { data: Inbox | null };
        if (inboxData) setInbox(inboxData);
      }
    } catch (err) {
      console.error('Failed to check connection:', err);
      setMessage({ type: 'error', text: 'Failed to check connection. Please try again.' });
    } finally {
      setCheckingConnection(false);
    }
  };

  const [deleting, setDeleting] = useState(false);

  const disconnectInbox = async () => {
    if (!confirm('Are you sure you want to disconnect this inbox? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setMessage(null);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(
        `${API_URL}/inboxes/${inboxId}?team_id=${teamId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!res.ok) {
        let errorMsg = 'Failed to disconnect inbox';
        try {
          const errorData = await res.json();
          errorMsg = errorData.message || errorMsg;
        } catch {
          errorMsg = await res.text().catch(() => errorMsg);
        }
        throw new Error(errorMsg);
      }

      router.push('/inboxes');
    } catch (error) {
      console.error('Failed to disconnect inbox:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to disconnect inbox. Please try again.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setDeleting(false);
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

  if (loading || teamLoading) {
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
            {isDisconnected ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-900 text-white dark:bg-red-900/80 dark:text-red-200">
                <WifiOff className="w-3.5 h-3.5" />
                DISCONNECTED
              </span>
            ) : (
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                inbox.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' :
                inbox.status === 'warming_up' ? 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300' :
                'bg-muted text-muted-foreground'
              }`}>
                {inbox.status === 'warming_up' ? 'Warming Up' : inbox.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Disconnected Banner */}
      {isDisconnected && (
        <div className="p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800 dark:text-red-300">
                This inbox is disconnected
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                Please reconnect your email account to resume sending and warmup.
              </p>
              <div className="flex gap-3 mt-3">
                <Link
                  href={`/inboxes/connect?reconnect=${inbox.id}&provider=${inbox.provider}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Reconnect
                </Link>
                <button
                  onClick={checkConnection}
                  disabled={checkingConnection}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 text-sm disabled:opacity-50"
                >
                  {checkingConnection ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Check Again
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* DNS Configuration */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">DNS Configuration</h2>
          </div>
          <button
            onClick={checkDns}
            disabled={checkingDns}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50"
          >
            {checkingDns ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Check DNS
              </>
            )}
          </button>
        </div>

        {!dnsValidation ? (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Click &quot;Check DNS&quot; to validate your domain&apos;s email authentication</p>
            <p className="text-sm mt-1">This checks SPF, DKIM, and DMARC records</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* DNS Score */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium text-foreground">DNS Health Score</span>
              <span className={`text-lg font-bold ${
                dnsValidation.validation.score >= 80 ? 'text-green-600 dark:text-green-400' :
                dnsValidation.validation.score >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {dnsValidation.validation.score}/100
              </span>
            </div>

            {/* SPF */}
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-3">
                {dnsValidation.validation.spf.valid ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                <div>
                  <p className="font-medium text-foreground">SPF Record</p>
                  <p className="text-xs text-muted-foreground">
                    {dnsValidation.validation.spf.record
                      ? dnsValidation.validation.spf.record.substring(0, 60) + (dnsValidation.validation.spf.record.length > 60 ? '...' : '')
                      : 'Not found'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                dnsValidation.validation.spf.valid
                  ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
              }`}>
                {dnsValidation.validation.spf.valid ? 'Valid' : 'Missing'}
              </span>
            </div>

            {/* DKIM */}
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-3">
                {dnsValidation.validation.dkim.valid ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                )}
                <div>
                  <p className="font-medium text-foreground">DKIM Record</p>
                  <p className="text-xs text-muted-foreground">
                    {dnsValidation.validation.dkim.selector
                      ? `Selector: ${dnsValidation.validation.dkim.selector}`
                      : 'Not configured'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                dnsValidation.validation.dkim.valid
                  ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300'
              }`}>
                {dnsValidation.validation.dkim.valid ? 'Valid' : 'Optional'}
              </span>
            </div>

            {/* DMARC */}
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-3">
                {dnsValidation.validation.dmarc.valid ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                )}
                <div>
                  <p className="font-medium text-foreground">DMARC Record</p>
                  <p className="text-xs text-muted-foreground">
                    {dnsValidation.validation.dmarc.policy
                      ? `Policy: ${dnsValidation.validation.dmarc.policy}`
                      : 'Not configured'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                dnsValidation.validation.dmarc.valid
                  ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300'
              }`}>
                {dnsValidation.validation.dmarc.valid ? 'Valid' : 'Recommended'}
              </span>
            </div>

            {/* Recommendations */}
            {dnsValidation.validation.recommendations.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">Recommendations:</p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                  {dnsValidation.validation.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sender Information */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Sender Information</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          These details are available as template variables in your campaigns and replies.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                👤 First Name
              </label>
              <input
                type="text"
                value={senderFirstName}
                onChange={(e) => setSenderFirstName(e.target.value)}
                placeholder="e.g., John"
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available as <code className="text-primary">{'{{senderFirstName}}'}</code>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                👤 Last Name
              </label>
              <input
                type="text"
                value={senderLastName}
                onChange={(e) => setSenderLastName(e.target.value)}
                placeholder="e.g., Smith"
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available as <code className="text-primary">{'{{senderLastName}}'}</code>
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              🏢 Company
            </label>
            <input
              type="text"
              value={senderCompany}
              onChange={(e) => setSenderCompany(e.target.value)}
              placeholder="e.g., Acme Inc."
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available as <code className="text-primary">{'{{senderCompany}}'}</code>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              💼 Title
            </label>
            <input
              type="text"
              value={senderTitle}
              onChange={(e) => setSenderTitle(e.target.value)}
              placeholder="e.g., Sales Director"
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available as <code className="text-primary">{'{{senderTitle}}'}</code>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                📞 Phone
              </label>
              <input
                type="text"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                placeholder="e.g., +1 555 123 4567"
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available as <code className="text-primary">{'{{senderPhone}}'}</code>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                🌐 Website
              </label>
              <input
                type="text"
                value={senderWebsite}
                onChange={(e) => setSenderWebsite(e.target.value)}
                placeholder="e.g., https://acme.com"
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available as <code className="text-primary">{'{{senderWebsite}}'}</code>
              </p>
            </div>
          </div>

          {(senderFirstName || senderLastName) && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">From Name:</span>{' '}
                {`${senderFirstName} ${senderLastName}`.trim()}
              </p>
            </div>
          )}
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
          disabled={deleting}
          className="inline-flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? 'Disconnecting...' : 'Disconnect Inbox'}
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
