'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Mail,
  Users,
  MessageSquare,
  TrendingUp,
  Clock,
  AlertCircle,
  FlaskConical,
  Trophy,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ArrowRight,
  WifiOff,
  RotateCcw,
  MousePointerClick,
  History,
  Info,
  Sparkles,
} from 'lucide-react';

interface SequenceVariant {
  id: string;
  sequence_id: string;
  variant_name: string;
  subject: string;
  body: string;
  weight: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  is_winner: boolean;
  smart_template_enabled?: boolean;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: string;
  lead_count: number;
  sent_count: number;
  opened_count: number;
  replied_count: number;
  bounced_count: number;
  started_at: string;
  created_at: string;
  settings?: {
    stop_on_reply?: boolean;
    [key: string]: unknown;
  };
  lead_lists?: { name: string };
  sequences?: Array<{
    id: string;
    step_number: number;
    delay_days: number;
    delay_hours: number;
    subject: string;
    body: string;
    sent_count: number;
    opened_count: number;
    replied_count: number;
    smart_template_enabled?: boolean;
    sequence_variants?: SequenceVariant[];
  }>;
  campaign_inboxes?: Array<{
    inbox_id: string;
    inboxes: { email: string; provider: string; status: string; status_reason?: string | null };
  }>;
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();
  const { teamId, loading: teamLoading, accessToken } = useTeam();

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());
  const [abActionLoading, setAbActionLoading] = useState<string | null>(null);
  const [testHistory, setTestHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnReplyLoading, setStopOnReplyLoading] = useState(false);

  const fetchCampaignData = async (tid: string) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        lead_lists(name),
        sequences(*, sequence_variants(*)),
        campaign_inboxes(inbox_id, inboxes(email, provider, status, status_reason))
      `)
      .eq('id', campaignId)
      .eq('team_id', tid)
      .single();

    if (error || !data) return null;
    return data;
  };

  useEffect(() => {
    if (teamLoading || !teamId) return;

    async function fetchData() {
      const data = await fetchCampaignData(teamId!);
      if (!data) {
        router.push('/campaigns');
        return;
      }

      setCampaign(data);
      setStopOnReply((data as any).settings?.stop_on_reply !== false);
      setLoading(false);
    }

    fetchData();
  }, [teamId, teamLoading, campaignId]);

  // Auto-refresh for active campaigns every 60s
  useEffect(() => {
    if (!teamId || !campaign || campaign.status !== 'active') return;

    const interval = setInterval(async () => {
      const data = await fetchCampaignData(teamId);
      if (data) setCampaign(data);
    }, 60000);

    return () => clearInterval(interval);
  }, [teamId, campaign?.status]);

  const handleStart = async () => {
    if (!campaign || !teamId) return;
    setActionLoading(true);

    const { error } = await (supabase
      .from('campaigns') as any)
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);

    if (!error) {
      setCampaign({ ...campaign, status: 'active', started_at: new Date().toISOString() });
    }

    setActionLoading(false);
  };

  const handlePause = async () => {
    if (!campaign || !teamId) return;
    setActionLoading(true);

    const { error } = await (supabase
      .from('campaigns') as any)
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);

    if (!error) {
      setCampaign({ ...campaign, status: 'paused' });
    }

    setActionLoading(false);
  };

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const handleDeclareWinner = async (sequenceId: string, variantId: string) => {
    if (!teamId || !accessToken) return;
    setAbActionLoading(variantId);
    try {
      const res = await fetch(`${apiUrl}/campaigns/${campaignId}/ab-test/${sequenceId}/winner?team_id=${teamId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ variantId }),
      });
      if (res.ok) {
        const data = await fetchCampaignData(teamId);
        if (data) setCampaign(data);
      }
    } catch (err) {
      console.error('Failed to declare winner:', err);
    }
    setAbActionLoading(null);
  };

  const handleResetTest = async (sequenceId: string) => {
    if (!teamId || !accessToken) return;
    setAbActionLoading(`reset-${sequenceId}`);
    try {
      const res = await fetch(`${apiUrl}/campaigns/${campaignId}/ab-test/${sequenceId}/reset?team_id=${teamId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await fetchCampaignData(teamId);
        if (data) setCampaign(data);
      }
    } catch (err) {
      console.error('Failed to reset test:', err);
    }
    setAbActionLoading(null);
  };

  const handleFetchHistory = async () => {
    if (!accessToken) return;
    setShowHistory(!showHistory);
    if (showHistory) return; // collapsing
    try {
      const res = await fetch(`${apiUrl}/campaigns/${campaignId}/ab-test/history`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTestHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch test history:', err);
    }
  };

  const handleToggleStopOnReply = async () => {
    if (!campaign) return;
    const newValue = !stopOnReply;
    setStopOnReply(newValue);
    setStopOnReplyLoading(true);
    try {
      const updatedSettings = { ...(campaign.settings || {}), stop_on_reply: newValue };
      await (supabase.from('campaigns') as any)
        .update({ settings: updatedSettings })
        .eq('id', campaign.id);
      setCampaign({ ...campaign, settings: updatedSettings });
    } catch (err) {
      console.error('Failed to update stop_on_reply:', err);
      setStopOnReply(!newValue); // revert on error
    }
    setStopOnReplyLoading(false);
  };

  if (loading || teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  const openRate = campaign.sent_count > 0
    ? Math.round((campaign.opened_count / campaign.sent_count) * 100)
    : 0;
  const replyRate = campaign.sent_count > 0
    ? Math.round((campaign.replied_count / campaign.sent_count) * 100)
    : 0;

  const toggleVariantExpansion = (seqId: string) => {
    const newExpanded = new Set(expandedVariants);
    if (newExpanded.has(seqId)) {
      newExpanded.delete(seqId);
    } else {
      newExpanded.add(seqId);
    }
    setExpandedVariants(newExpanded);
  };

  const getVariantColor = (index: number) => {
    const colors = [
      { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
      { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
      { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
      { bg: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Campaigns
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          {campaign.description && (
            <p className="text-gray-500 mt-1">{campaign.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {campaign.status === 'draft' && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Start Campaign
            </button>
          )}
          {campaign.status === 'active' && (
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}
          <Link
            href={`/campaigns/${campaign.id}/settings`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Settings className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          campaign.status === 'active'
            ? 'bg-green-100 text-green-800'
            : campaign.status === 'paused'
            ? 'bg-yellow-100 text-yellow-800'
            : campaign.status === 'draft'
            ? 'bg-gray-100 text-gray-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {campaign.status}
        </span>
        {campaign.lead_lists && (
          <span className="text-sm text-gray-500">
            <Users className="w-4 h-4 inline mr-1" />
            {campaign.lead_lists.name}
          </span>
        )}
        {campaign.started_at && (
          <span className="text-sm text-gray-500">
            <Clock className="w-4 h-4 inline mr-1" />
            Started {new Date(campaign.started_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{campaign.lead_count}</p>
              <p className="text-sm text-gray-500">Leads</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{campaign.sent_count}</p>
              <p className="text-sm text-gray-500">Sent</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{openRate}%</p>
              <p className="text-sm text-gray-500">Open Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{replyRate}%</p>
              <p className="text-sm text-gray-500">Reply Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{campaign.bounced_count}</p>
              <p className="text-sm text-gray-500">Bounced</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sequence Performance Funnel */}
      {campaign.sequences && campaign.sequences.length > 0 && (
        <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sequence Performance</h2>
          </div>

          {/* Funnel Visualization */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4">
            {campaign.sequences.sort((a, b) => a.step_number - b.step_number).map((seq, index) => {
              const prevSeq = index > 0 ? campaign.sequences!.sort((a, b) => a.step_number - b.step_number)[index - 1] : null;
              const dropoffRate = prevSeq && prevSeq.sent_count > 0
                ? Math.round(((prevSeq.sent_count - seq.sent_count) / prevSeq.sent_count) * 100)
                : 0;
              const seqOpenRate = seq.sent_count > 0 ? Math.round((seq.opened_count / seq.sent_count) * 100) : 0;
              const seqReplyRate = seq.sent_count > 0 ? Math.round((seq.replied_count / seq.sent_count) * 100) : 0;

              return (
                <div key={seq.id} className="flex items-center gap-2">
                  <div className="flex flex-col items-center min-w-[120px]">
                    <div className={`w-full p-4 rounded-lg text-center ${
                      index === 0
                        ? 'bg-blue-100 dark:bg-blue-500/20 border-2 border-blue-300 dark:border-blue-500/50'
                        : 'bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                    }`}>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Step {seq.step_number}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{seq.sent_count}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">sent</p>
                    </div>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-green-600 dark:text-green-400" title="Open Rate">
                        {seqOpenRate}% <span className="text-gray-400">opens</span>
                      </span>
                      <span className="text-purple-600 dark:text-purple-400" title="Reply Rate">
                        {seqReplyRate}% <span className="text-gray-400">replies</span>
                      </span>
                    </div>
                  </div>

                  {index < (campaign.sequences?.length ?? 0) - 1 && (
                    <div className="flex flex-col items-center">
                      <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      {dropoffRate > 0 && (
                        <span className="text-[10px] text-red-500 dark:text-red-400 mt-1">
                          -{dropoffRate}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary Stats */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#353b48] grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {campaign.sequences.reduce((sum, s) => sum + s.sent_count, 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Emails Sent</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {campaign.sequences.reduce((sum, s) => sum + s.opened_count, 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Opened</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {campaign.sequences.reduce((sum, s) => sum + s.replied_count, 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Replies</p>
            </div>
          </div>
        </div>
      )}

      {/* Sequences */}
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48]">
        <div className="p-6 border-b border-gray-200 dark:border-[#353b48]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Sequence</h2>
          </div>
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-[#353b48]">
            <button
              type="button"
              role="switch"
              aria-checked={stopOnReply}
              disabled={stopOnReplyLoading}
              onClick={handleToggleStopOnReply}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:opacity-50',
                stopOnReply ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                  stopOnReply ? 'translate-x-[18px]' : 'translate-x-0.5'
                )}
              />
            </button>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Stop on reply</span>
            <div className="relative group">
              <Info className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs rounded-lg w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none z-10">
                When enabled, the campaign will stop sending follow-up emails to a lead once they reply. This allows you to respond personally from the Unibox.
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-white" />
              </div>
            </div>
          </div>
        </div>
        <div>
          {campaign.sequences?.sort((a, b) => a.step_number - b.step_number).map((seq, index) => {
            const seqOpenRate = seq.sent_count > 0
              ? Math.round((seq.opened_count / seq.sent_count) * 100)
              : 0;
            const seqReplyRate = seq.sent_count > 0
              ? Math.round((seq.replied_count / seq.sent_count) * 100)
              : 0;
            const hasVariants = seq.sequence_variants && seq.sequence_variants.length > 0;
            const isExpanded = expandedVariants.has(seq.id);
            const hasSmartTemplate = seq.smart_template_enabled || (hasVariants && seq.sequence_variants!.some(v => v.smart_template_enabled));

            return (
              <Fragment key={seq.id}>
                {/* Delay connector between steps */}
                {index > 0 && (
                  <div className="flex flex-col items-center py-1">
                    <div className="w-px h-4 bg-gray-200 dark:bg-[#353b48]" />
                    <div className="flex items-center gap-2 px-4 py-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Wait</span>
                      {[1, 3, 5].map((days) => (
                        <span
                          key={days}
                          className={cn(
                            'px-2.5 py-1 text-xs font-medium rounded-full border',
                            seq.delay_days === days && seq.delay_hours === 0
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white dark:bg-[#262b36] text-gray-400 dark:text-gray-500 border-gray-200 dark:border-[#353b48]'
                          )}
                        >
                          {days} day{days > 1 ? 's' : ''}
                        </span>
                      ))}
                      {/* Show custom badge for non-preset delays */}
                      {(![1, 3, 5].includes(seq.delay_days) || seq.delay_hours > 0) && (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary text-white border border-primary">
                          {seq.delay_days}d{seq.delay_hours > 0 ? ` ${seq.delay_hours}h` : ''}
                        </span>
                      )}
                    </div>
                    <div className="w-px h-4 bg-gray-200 dark:bg-[#353b48]" />
                  </div>
                )}

                <div className={cn('p-6', index > 0 && 'border-t border-gray-200 dark:border-[#353b48]')}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{seq.step_number}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">{seq.subject || '(No subject)'}</h3>
                      {hasSmartTemplate && (
                        <span className="inline-flex items-center gap-1 text-xs bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
                          <Sparkles className="w-3 h-3" />
                          Smart Template
                        </span>
                      )}
                      {hasVariants && (
                        <span className="inline-flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                          <FlaskConical className="w-3 h-3" />
                          {seq.sequence_variants!.length} variants
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                      {seq.body?.substring(0, 150)}...
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        <strong className="text-gray-900 dark:text-white">{seq.sent_count}</strong> sent
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        <strong className="text-gray-900 dark:text-white">{seqOpenRate}%</strong> opened
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        <strong className="text-gray-900 dark:text-white">{seqReplyRate}%</strong> replied
                      </span>
                    </div>

                    {/* A/B Variant Performance */}
                    {hasVariants && (
                      <div className="mt-4 border-t border-gray-200 dark:border-[#353b48] pt-4">
                        <button
                          onClick={() => toggleVariantExpansion(seq.id)}
                          className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                        >
                          <FlaskConical className="w-4 h-4" />
                          A/B Test Performance
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-4 space-y-3">
                            {/* Action Buttons */}
                            {!seq.sequence_variants!.some(v => v.is_winner) && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleResetTest(seq.id)}
                                  disabled={abActionLoading === `reset-${seq.id}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                                >
                                  <RotateCcw className={`w-3 h-3 ${abActionLoading === `reset-${seq.id}` ? 'animate-spin' : ''}`} />
                                  Reset Test
                                </button>
                              </div>
                            )}

                            {/* Confidence Meter */}
                            {(() => {
                              const totalSent = seq.sequence_variants!.reduce((s, v) => s + v.sent_count, 0);
                              const minPerVariant = 50;
                              const allHaveMin = seq.sequence_variants!.every(v => v.sent_count >= minPerVariant);
                              const progress = allHaveMin ? Math.min(100, Math.round((totalSent / (minPerVariant * seq.sequence_variants!.length * 4)) * 100)) : Math.round((totalSent / (minPerVariant * seq.sequence_variants!.length)) * 100);
                              return (
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Data Collection Progress</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{totalSent} total sends</span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all ${progress >= 75 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                      style={{ width: `${Math.min(progress, 100)}%` }}
                                    ></div>
                                  </div>
                                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                    {!allHaveMin ? `Need ${minPerVariant} sends per variant before optimization starts` : 'Optimizer is actively analyzing results'}
                                  </p>
                                </div>
                              );
                            })()}

                            {/* Variant Performance Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#353b48]">
                                    <th className="pb-2 font-medium">Variant</th>
                                    <th className="pb-2 font-medium text-right">Sent</th>
                                    <th className="pb-2 font-medium text-right">Opens</th>
                                    <th className="pb-2 font-medium text-right">Open Rate</th>
                                    <th className="pb-2 font-medium text-right">Clicks</th>
                                    <th className="pb-2 font-medium text-right">Click Rate</th>
                                    <th className="pb-2 font-medium text-right">Replies</th>
                                    <th className="pb-2 font-medium text-right">Reply Rate</th>
                                    <th className="pb-2 font-medium text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {seq.sequence_variants!.map((variant, vIndex) => {
                                    const variantOpenRate = variant.sent_count > 0
                                      ? Math.round((variant.opened_count / variant.sent_count) * 100)
                                      : 0;
                                    const variantClickRate = variant.opened_count > 0
                                      ? Math.round((variant.clicked_count / variant.opened_count) * 100)
                                      : 0;
                                    const variantReplyRate = variant.sent_count > 0
                                      ? Math.round((variant.replied_count / variant.sent_count) * 100)
                                      : 0;
                                    const colors = getVariantColor(vIndex);
                                    const hasAnyWinner = seq.sequence_variants!.some(v => v.is_winner);

                                    return (
                                      <tr key={variant.id} className="border-b border-gray-100 dark:border-[#353b48]/50">
                                        <td className="py-3">
                                          <div className="flex items-center gap-2">
                                            <span className={`w-3 h-3 rounded-full ${colors.dot}`}></span>
                                            <span className="font-medium text-gray-900 dark:text-white">{variant.variant_name}</span>
                                            {variant.is_winner && (
                                              <Trophy className="w-4 h-4 text-yellow-500" />
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-3 text-right text-gray-900 dark:text-white">{variant.sent_count}</td>
                                        <td className="py-3 text-right text-gray-900 dark:text-white">{variant.opened_count}</td>
                                        <td className="py-3 text-right">
                                          <span className={`px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                            {variantOpenRate}%
                                          </span>
                                        </td>
                                        <td className="py-3 text-right text-gray-900 dark:text-white">{variant.clicked_count}</td>
                                        <td className="py-3 text-right">
                                          <span className={`px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                            {variantClickRate}%
                                          </span>
                                        </td>
                                        <td className="py-3 text-right text-gray-900 dark:text-white">{variant.replied_count}</td>
                                        <td className="py-3 text-right">
                                          <span className={`px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                            {variantReplyRate}%
                                          </span>
                                        </td>
                                        <td className="py-3 text-right">
                                          {variant.is_winner ? (
                                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                                              <Trophy className="w-3 h-3" />
                                              Winner
                                            </span>
                                          ) : hasAnyWinner ? (
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                              {variant.weight}% traffic
                                            </span>
                                          ) : (
                                            <div className="flex items-center gap-2 justify-end">
                                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                                {variant.weight}%
                                              </span>
                                              <button
                                                onClick={() => handleDeclareWinner(seq.id, variant.id)}
                                                disabled={abActionLoading === variant.id}
                                                className="inline-flex items-center gap-1 text-[10px] bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded hover:bg-yellow-200 dark:hover:bg-yellow-500/30 disabled:opacity-50"
                                              >
                                                <Trophy className="w-3 h-3" />
                                                {abActionLoading === variant.id ? '...' : 'Declare Winner'}
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Statistical Significance Note */}
                            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                              <p className="text-xs text-blue-700 dark:text-blue-300">
                                <strong>Note:</strong> The winning variant is automatically selected when statistical significance (95% confidence) is reached with progressive traffic shifting.
                                A minimum of 50 sends per variant is required before optimization begins.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </Fragment>
            );
          })}
          {(!campaign.sequences || campaign.sequences.length === 0) && (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No sequences defined yet
            </div>
          )}
        </div>
      </div>

      {/* A/B Test History */}
      {campaign.sequences?.some(s => s.sequence_variants && s.sequence_variants.length > 0) && (
        <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48]">
          <button
            onClick={handleFetchHistory}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#2a2f3a] rounded-xl"
          >
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">A/B Test History</h2>
            </div>
            {showHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          {showHistory && (
            <div className="px-6 pb-6 border-t border-gray-200 dark:border-[#353b48]">
              {testHistory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 pt-4">No optimization events yet</p>
              ) : (
                <div className="space-y-3 pt-4">
                  {testHistory.map((event: any) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        event.event_type === 'winner_declared' || event.event_type === 'manual_override'
                          ? 'bg-green-500'
                          : event.event_type === 'weight_adjusted'
                          ? 'bg-blue-500'
                          : 'bg-gray-400'
                      }`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {event.event_type === 'winner_declared' ? 'Winner Declared (Auto)' :
                           event.event_type === 'manual_override' ? 'Winner Declared (Manual)' :
                           event.event_type === 'weight_adjusted' ? 'Traffic Weights Adjusted' :
                           event.event_type === 'test_reset' ? 'Test Reset' :
                           event.event_type}
                        </p>
                        {event.confidence && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Confidence: {(event.confidence * 100).toFixed(1)}% | Metric: {event.metric}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inboxes */}
      {campaign.campaign_inboxes && campaign.campaign_inboxes.length > 0 && (() => {
        const disconnectedInboxes = campaign.campaign_inboxes!.filter(
          (ci) => ci.inboxes?.status === 'error' && ci.inboxes?.status_reason?.includes('disconnected')
        );
        const hasDisconnected = disconnectedInboxes.length > 0;

        return (
          <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48]">
            <div className="p-6 border-b border-gray-200 dark:border-[#353b48]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sending Inboxes</h2>
            </div>
            {hasDisconnected && (
              <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      {disconnectedInboxes.length === 1
                        ? '1 sending inbox is disconnected'
                        : `${disconnectedInboxes.length} sending inboxes are disconnected`}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      The campaign will continue with remaining connected inboxes. Reconnect the affected inboxes to restore full capacity.
                    </p>
                    <Link
                      href="/inboxes"
                      className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-red-800 dark:text-red-300 hover:underline"
                    >
                      View Inboxes
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {campaign.campaign_inboxes.map((ci) => {
                  const isDisconnected = ci.inboxes?.status === 'error' && ci.inboxes?.status_reason?.includes('disconnected');
                  return (
                    <span
                      key={ci.inbox_id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                        isDisconnected
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-700/50 text-gray-900 dark:text-white'
                      }`}
                    >
                      {isDisconnected ? (
                        <WifiOff className="w-4 h-4 text-red-500 dark:text-red-400" />
                      ) : (
                        <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                      {ci.inboxes?.email}
                      {isDisconnected && (
                        <span className="text-[10px] font-medium uppercase">disconnected</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
