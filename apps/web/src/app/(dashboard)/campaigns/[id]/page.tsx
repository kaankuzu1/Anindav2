'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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
} from 'lucide-react';

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
  }>;
  campaign_inboxes?: Array<{
    inbox_id: string;
    inboxes: { email: string; provider: string };
  }>;
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
        router.push('/dashboard');
        return;
      }

      const tid = teamMembers[0].team_id;
      setTeamId(tid);

      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          lead_lists(name),
          sequences(*),
          campaign_inboxes(inbox_id, inboxes(email, provider))
        `)
        .eq('id', campaignId)
        .eq('team_id', tid)
        .single();

      if (error || !data) {
        router.push('/campaigns');
        return;
      }

      setCampaign(data);
      setLoading(false);
    }

    fetchData();
  }, [campaignId, supabase, router]);

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

  const openRate = campaign.sent_count > 0
    ? Math.round((campaign.opened_count / campaign.sent_count) * 100)
    : 0;
  const replyRate = campaign.sent_count > 0
    ? Math.round((campaign.replied_count / campaign.sent_count) * 100)
    : 0;

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
            href={`/campaigns/${campaign.id}/edit`}
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

      {/* Sequences */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Email Sequence</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {campaign.sequences?.sort((a, b) => a.step_number - b.step_number).map((seq) => {
            const seqOpenRate = seq.sent_count > 0
              ? Math.round((seq.opened_count / seq.sent_count) * 100)
              : 0;
            const seqReplyRate = seq.sent_count > 0
              ? Math.round((seq.replied_count / seq.sent_count) * 100)
              : 0;

            return (
              <div key={seq.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{seq.step_number}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="font-medium text-gray-900">{seq.subject || '(No subject)'}</h3>
                      {seq.step_number > 1 && (
                        <span className="text-sm text-gray-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Wait {seq.delay_days}d {seq.delay_hours}h
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {seq.body?.substring(0, 150)}...
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-gray-500">
                        <strong className="text-gray-900">{seq.sent_count}</strong> sent
                      </span>
                      <span className="text-gray-500">
                        <strong className="text-gray-900">{seqOpenRate}%</strong> opened
                      </span>
                      <span className="text-gray-500">
                        <strong className="text-gray-900">{seqReplyRate}%</strong> replied
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {(!campaign.sequences || campaign.sequences.length === 0) && (
            <div className="p-6 text-center text-gray-500">
              No sequences defined yet
            </div>
          )}
        </div>
      </div>

      {/* Inboxes */}
      {campaign.campaign_inboxes && campaign.campaign_inboxes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Sending Inboxes</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {campaign.campaign_inboxes.map((ci) => (
                <span
                  key={ci.inbox_id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
                >
                  <Mail className="w-4 h-4 text-gray-500" />
                  {ci.inboxes?.email}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
