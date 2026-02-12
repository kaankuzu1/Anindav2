'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Save,
  Trash2,
  Mail,
  Clock,
  AlertTriangle,
  Eye,
  MousePointerClick,
  StopCircle,
} from 'lucide-react';
import { CampaignScheduler } from '@/components/campaigns/campaign-scheduler';
import type { ScheduleData, DayKey } from '@/components/campaigns/time-interval-slider';

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: string;
  settings?: {
    schedule?: Partial<Record<string, { start: number; end: number }[]>>;
    timezone?: string;
    send_days?: string[];
    send_window_start?: string;
    send_window_end?: string;
    stop_on_reply?: boolean;
    track_opens?: boolean;
    track_clicks?: boolean;
    [key: string]: unknown;
  };
  sequences?: Array<{
    id: string;
    step_number: number;
    delay_days: number;
    delay_hours: number;
    subject: string;
    body: string;
  }>;
  campaign_inboxes?: Array<{
    inbox_id: string;
    inboxes: { email: string; provider: string; status: string };
  }>;
}

export default function CampaignSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    schedule: {
      mon: [{ start: 9, end: 17 }],
      tue: [{ start: 9, end: 17 }],
      wed: [{ start: 9, end: 17 }],
      thu: [{ start: 9, end: 17 }],
      fri: [{ start: 9, end: 17 }],
    },
    timezone: typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York',
  });

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAccessToken(session.access_token);
      }

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1) as { data: { team_id: string }[] | null };

      if (!teamMembers || teamMembers.length === 0) {
        router.push('/campaigns');
        return;
      }

      const tid = teamMembers[0].team_id;
      setTeamId(tid);

      const { data, error: fetchError } = await supabase
        .from('campaigns')
        .select(`
          *,
          sequences(id, step_number, delay_days, delay_hours, subject, body),
          campaign_inboxes(inbox_id, inboxes(email, provider, status))
        `)
        .eq('id', campaignId)
        .eq('team_id', tid)
        .single();

      if (fetchError || !data) {
        router.push('/campaigns');
        return;
      }

      const campaignData = data as Campaign;
      setCampaign(campaignData);

      // Initialize form state from campaign data
      setName(campaignData.name || '');
      setStopOnReply(campaignData.settings?.stop_on_reply !== false);
      setTrackOpens(campaignData.settings?.track_opens !== false);
      setTrackClicks(campaignData.settings?.track_clicks === true);

      // Initialize schedule from campaign settings
      if (campaignData.settings?.schedule) {
        const schedule = campaignData.settings.schedule as Partial<Record<DayKey, { start: number; end: number }[]>>;
        setScheduleData({
          schedule,
          timezone: campaignData.settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      } else if (campaignData.settings?.send_days) {
        // Fallback: reconstruct from send_days + send_window
        const startHour = campaignData.settings.send_window_start
          ? parseInt(campaignData.settings.send_window_start.split(':')[0], 10)
          : 9;
        const endHour = campaignData.settings.send_window_end
          ? parseInt(campaignData.settings.send_window_end.split(':')[0], 10)
          : 17;
        const schedule: Partial<Record<DayKey, { start: number; end: number }[]>> = {};
        for (const day of campaignData.settings.send_days) {
          schedule[day as DayKey] = [{ start: startHour, end: endHour }];
        }
        setScheduleData({
          schedule,
          timezone: campaignData.settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }

      setLoading(false);
    }

    fetchData();
  }, [campaignId, supabase, router]);

  const handleSave = async () => {
    if (!campaign || !teamId || !accessToken) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const allIntervals = Object.values(scheduleData.schedule).flat().filter(Boolean);
      const earliestStart = allIntervals.length > 0 ? Math.min(...allIntervals.map(i => i!.start)) : 9;
      const latestEnd = allIntervals.length > 0 ? Math.max(...allIntervals.map(i => i!.end)) : 17;

      const updatedSettings = {
        ...(campaign.settings || {}),
        schedule: scheduleData.schedule,
        timezone: scheduleData.timezone,
        send_days: Object.keys(scheduleData.schedule),
        send_window_start: `${String(earliestStart).padStart(2, '0')}:00`,
        send_window_end: `${String(latestEnd).padStart(2, '0')}:00`,
        stop_on_reply: stopOnReply,
        track_opens: trackOpens,
        track_clicks: trackClicks,
      };

      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      const res = await fetch(`${apiUrl}/campaigns/${campaignId}?team_id=${teamId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name, settings: updatedSettings }),
      });

      if (!res.ok) {
        let errMsg = 'Failed to save settings';
        try {
          const errData = await res.json();
          errMsg = errData.message || errMsg;
        } catch {
          errMsg = await res.text() || errMsg;
        }
        throw new Error(errMsg);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Update local campaign state
      setCampaign({ ...campaign, name, settings: updatedSettings });
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!campaign || !teamId || !accessToken) return;

    setDeleting(true);
    setError(null);

    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      const res = await fetch(`${apiUrl}/campaigns/${campaignId}?team_id=${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        let errMsg = 'Failed to delete campaign';
        try {
          const errData = await res.json();
          errMsg = errData.message || errMsg;
        } catch {
          errMsg = await res.text() || errMsg;
        }
        throw new Error(errMsg);
      }

      router.push('/campaigns');
    } catch (err: any) {
      setError(err.message || 'Failed to delete campaign');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href={`/campaigns/${campaignId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {campaign.name}
      </Link>

      <div className="bg-card rounded-xl border border-border mb-6">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">Campaign Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your campaign behavior and schedule</p>
        </div>

        <div className="p-6 space-y-8">
          {/* Error / Success Messages */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}
          {saveSuccess && (
            <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">Settings saved successfully.</p>
            </div>
          )}

          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Campaign Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 Product Outreach"
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Tracking */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Tracking</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={trackOpens}
                  onClick={() => setTrackOpens(!trackOpens)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                    trackOpens ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                      trackOpens ? 'translate-x-[18px]' : 'translate-x-0.5'
                    )}
                  />
                </button>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Track Opens</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={trackClicks}
                  onClick={() => setTrackClicks(!trackClicks)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                    trackClicks ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                      trackClicks ? 'translate-x-[18px]' : 'translate-x-0.5'
                    )}
                  />
                </button>
                <div className="flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Track Clicks</span>
                </div>
              </div>
            </div>
          </div>

          {/* Behavior */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Behavior</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={stopOnReply}
                onClick={() => setStopOnReply(!stopOnReply)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                  stopOnReply ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                    stopOnReply ? 'translate-x-[18px]' : 'translate-x-0.5'
                  )}
                />
              </button>
              <div className="flex items-center gap-2">
                <StopCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Stop on Reply</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 ml-12">
              When enabled, the campaign will stop sending follow-up emails to a lead once they reply.
            </p>
          </div>
        </div>
      </div>

      {/* Send Schedule */}
      <CampaignScheduler value={scheduleData} onChange={setScheduleData} />

      {/* Sending Inboxes (Read-only) */}
      {campaign.campaign_inboxes && campaign.campaign_inboxes.length > 0 && (
        <div className="bg-card rounded-xl border border-border mb-6">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Sending Inboxes</h2>
            <p className="text-sm text-muted-foreground mt-1">Inboxes assigned to this campaign</p>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {campaign.campaign_inboxes.map((ci) => (
                <span
                  key={ci.inbox_id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm text-foreground"
                >
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {ci.inboxes?.email}
                  <span className="text-xs text-muted-foreground capitalize">({ci.inboxes?.provider})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sequences (Read-only) */}
      {campaign.sequences && campaign.sequences.length > 0 && (
        <div className="bg-card rounded-xl border border-border mb-6">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Email Sequence</h2>
            <p className="text-sm text-muted-foreground mt-1">Steps in this campaign</p>
          </div>
          <div className="divide-y divide-border">
            {campaign.sequences.sort((a, b) => a.step_number - b.step_number).map((seq) => (
              <div key={seq.id} className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{seq.step_number}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{seq.subject || '(No subject)'}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {seq.step_number > 1 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Wait {seq.delay_days}d{seq.delay_hours > 0 ? ` ${seq.delay_hours}h` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 ml-12">
                  {seq.body?.substring(0, 150)}{seq.body && seq.body.length > 150 ? '...' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4 mb-8">
        <Link
          href={`/campaigns/${campaignId}`}
          className="px-4 py-2 text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving || !name}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-card rounded-xl border-2 border-red-200 dark:border-red-500/30 mb-8">
        <div className="p-6 border-b border-red-200 dark:border-red-500/30">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Delete this campaign</p>
              <p className="text-sm text-muted-foreground mt-1">
                Once you delete a campaign, there is no going back. This will remove all associated data.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-flex items-center gap-2 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              Delete Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Delete Campaign</h2>
              </div>
              <p className="text-muted-foreground mb-2">
                Are you sure you want to delete <strong className="text-foreground">{campaign.name}</strong>?
              </p>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. All campaign data, sequences, and statistics will be permanently removed.
              </p>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Campaign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
