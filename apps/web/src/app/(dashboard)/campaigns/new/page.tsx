'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { aiClient } from '@/lib/ai/client';
import { ArrowLeft, Plus, Trash2, Clock, Mail, Users, Inbox, Sparkles, Wand2, RefreshCw, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface Sequence {
  step_number: number;
  delay_days: number;
  delay_hours: number;
  subject: string;
  body: string;
}

interface LeadList {
  id: string;
  name: string;
  lead_count: number;
}

interface InboxOption {
  id: string;
  email: string;
  provider: string;
  status: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLeadList, setSelectedLeadList] = useState<string>('');
  const [selectedInboxes, setSelectedInboxes] = useState<string[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([
    { step_number: 1, delay_days: 0, delay_hours: 0, subject: '', body: '' },
  ]);

  // Options
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);

  // AI State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProductDescription, setAiProductDescription] = useState('');
  const [aiTargetAudience, setAiTargetAudience] = useState('');
  const [aiTone, setAiTone] = useState<'professional' | 'casual' | 'friendly' | 'urgent'>('professional');
  const [aiSenderName, setAiSenderName] = useState('');
  const [aiCompanyName, setAiCompanyName] = useState('');

  // Spam Check State
  const [spamChecking, setSpamChecking] = useState(false);
  const [spamResults, setSpamResults] = useState<{
    stepIndex: number;
    riskLevel: 'low' | 'medium' | 'high';
    score: number;
    issues: string[];
    suggestions: string[];
    rewrittenVersion?: string;
  } | null>(null);

  // Fetch team and options
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Get access token for AI API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAccessToken(session.access_token);
      }

      // Get team
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1) as { data: { team_id: string }[] | null };

      if (teamMembers && teamMembers.length > 0) {
        const tid = teamMembers[0].team_id;
        setTeamId(tid);

        // Fetch lead lists
        const { data: lists } = await supabase
          .from('lead_lists')
          .select('id, name, lead_count')
          .eq('team_id', tid)
          .order('created_at', { ascending: false });

        setLeadLists(lists ?? []);

        // Fetch active inboxes
        const { data: inboxData } = await supabase
          .from('inboxes')
          .select('id, email, provider, status')
          .eq('team_id', tid)
          .in('status', ['active', 'warming_up']);

        setInboxes(inboxData ?? []);
      }

      setLoading(false);
    }

    fetchData();
  }, [supabase, router]);

  const addSequence = () => {
    const lastSeq = sequences[sequences.length - 1];
    setSequences([
      ...sequences,
      {
        step_number: sequences.length + 1,
        delay_days: 2,
        delay_hours: 0,
        subject: lastSeq?.subject ? `Re: ${lastSeq.subject.replace(/^Re:\s*/i, '')}` : '',
        body: '',
      },
    ]);
  };

  const removeSequence = (index: number) => {
    if (sequences.length <= 1) return;
    const updated = sequences.filter((_, i) => i !== index).map((seq, i) => ({
      ...seq,
      step_number: i + 1,
    }));
    setSequences(updated);
  };

  const updateSequence = (index: number, field: keyof Sequence, value: string | number) => {
    const updated = [...sequences];
    updated[index] = { ...updated[index], [field]: value };
    setSequences(updated);
  };

  // AI Campaign Generation
  const generateAICampaign = async () => {
    if (!accessToken || !aiProductDescription || !aiTargetAudience) return;

    setAiGenerating(true);

    try {
      const result = await aiClient.generateCampaign(
        aiProductDescription,
        aiTargetAudience,
        aiTone,
        aiSenderName || undefined,
        aiCompanyName || undefined,
        accessToken,
      );

      // Create sequences from AI result
      const newSequences: Sequence[] = [
        {
          step_number: 1,
          delay_days: 0,
          delay_hours: 0,
          subject: result.subject,
          body: result.firstEmail,
        },
        {
          step_number: 2,
          delay_days: 2,
          delay_hours: 0,
          subject: `Re: ${result.subject}`,
          body: result.followUp1,
        },
        {
          step_number: 3,
          delay_days: 4,
          delay_hours: 0,
          subject: `Re: ${result.subject}`,
          body: result.followUp2,
        },
        {
          step_number: 4,
          delay_days: 7,
          delay_hours: 0,
          subject: `Last chance: ${result.subject}`,
          body: result.breakupEmail,
        },
      ];

      setSequences(newSequences);
      setShowAIModal(false);

      // Auto-set campaign name if empty
      if (!name) {
        setName(`${aiTargetAudience} Outreach`);
      }
    } catch (error) {
      console.error('AI Campaign generation failed:', error);
      alert('Failed to generate campaign. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  // Spam Risk Check
  const checkSpamRisk = async (stepIndex: number) => {
    if (!accessToken) return;

    const seq = sequences[stepIndex];
    if (!seq.subject || !seq.body) {
      alert('Please fill in subject and body first.');
      return;
    }

    setSpamChecking(true);
    setSpamResults(null);

    try {
      const result = await aiClient.checkSpamRisk(
        seq.body,
        seq.subject,
        accessToken,
      );

      setSpamResults({
        stepIndex,
        ...result,
      });
    } catch (error) {
      console.error('Spam check failed:', error);
      alert('Failed to check spam risk. Please try again.');
    } finally {
      setSpamChecking(false);
    }
  };

  const applySpamSuggestion = () => {
    if (!spamResults || !spamResults.rewrittenVersion) return;

    const updated = [...sequences];
    updated[spamResults.stepIndex] = {
      ...updated[spamResults.stepIndex],
      body: spamResults.rewrittenVersion,
    };
    setSequences(updated);
    setSpamResults(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !name || sequences.length === 0) return;

    setSaving(true);

    try {
      // Create campaign
      const { data: campaign, error: campaignError } = await (supabase
        .from('campaigns') as any)
        .insert({
          team_id: teamId,
          name,
          description,
          lead_list_id: selectedLeadList || null,
          status: 'draft',
          settings: {},
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create sequences
      const sequenceInserts = sequences.map((seq) => ({
        campaign_id: campaign.id,
        step_number: seq.step_number,
        delay_days: seq.delay_days,
        delay_hours: seq.delay_hours,
        subject: seq.subject,
        body: seq.body,
      }));

      const { error: seqError } = await (supabase
        .from('sequences') as any)
        .insert(sequenceInserts);

      if (seqError) throw seqError;

      // Link inboxes
      if (selectedInboxes.length > 0) {
        const inboxInserts = selectedInboxes.map((inboxId) => ({
          campaign_id: campaign.id,
          inbox_id: inboxId,
        }));

        await (supabase.from('campaign_inboxes') as any).insert(inboxInserts);
      }

      router.push(`/campaigns/${campaign.id}`);
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert('Failed to create campaign. Please try again.');
    } finally {
      setSaving(false);
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
    <div className="max-w-4xl mx-auto">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Campaigns
      </Link>

      <form onSubmit={handleSubmit}>
        <div className="bg-card rounded-xl border border-border mb-6">
          <div className="p-6 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Create Campaign</h1>
                <p className="text-muted-foreground mt-1">Set up a new email sequence campaign</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAIModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q1 Product Outreach"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the campaign..."
                  rows={2}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            {/* Lead List Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                <Users className="w-4 h-4 inline mr-1" />
                Lead List
              </label>
              <select
                value={selectedLeadList}
                onChange={(e) => setSelectedLeadList(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select a lead list...</option>
                {leadLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({list.lead_count} leads)
                  </option>
                ))}
              </select>
              {leadLists.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  No lead lists found.{' '}
                  <Link href="/leads/import" className="text-primary hover:underline">
                    Import leads first
                  </Link>
                </p>
              )}
            </div>

            {/* Inbox Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <Inbox className="w-4 h-4 inline mr-1" />
                Sending Inboxes
              </label>
              <div className="space-y-2">
                {inboxes.map((inbox) => (
                  <label
                    key={inbox.id}
                    className="flex items-center gap-3 p-3 border border-border rounded-lg hover:border-primary/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedInboxes.includes(inbox.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInboxes([...selectedInboxes, inbox.id]);
                        } else {
                          setSelectedInboxes(selectedInboxes.filter((id) => id !== inbox.id));
                        }
                      }}
                      className="w-4 h-4 text-primary rounded focus:ring-primary"
                    />
                    <div>
                      <p className="font-medium text-foreground">{inbox.email}</p>
                      <p className="text-sm text-muted-foreground capitalize">{inbox.provider}</p>
                    </div>
                    {inbox.status === 'warming_up' && (
                      <span className="ml-auto text-xs bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300 px-2 py-1 rounded">
                        Warming up
                      </span>
                    )}
                  </label>
                ))}
                {inboxes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No inboxes connected.{' '}
                    <Link href="/inboxes/connect" className="text-primary hover:underline">
                      Connect an inbox first
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sequences */}
        <div className="bg-card rounded-xl border border-border mb-6">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Email Sequence</h2>
              <p className="text-sm text-muted-foreground">Define the emails to send in order</p>
            </div>
            <button
              type="button"
              onClick={addSequence}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80"
            >
              <Plus className="w-4 h-4" />
              Add Step
            </button>
          </div>

          <div className="divide-y divide-border">
            {sequences.map((seq, index) => (
              <div key={index} className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{seq.step_number}</span>
                  </div>
                  <h3 className="font-medium text-foreground">Step {seq.step_number}</h3>

                  {index > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Wait</span>
                      <input
                        type="number"
                        min="0"
                        value={seq.delay_days}
                        onChange={(e) => updateSequence(index, 'delay_days', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-sm border border-border rounded bg-card text-foreground"
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={seq.delay_hours}
                        onChange={(e) => updateSequence(index, 'delay_hours', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-sm border border-border rounded bg-card text-foreground"
                      />
                      <span className="text-sm text-muted-foreground">hours</span>
                    </div>
                  )}

                  {sequences.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSequence(index)}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={seq.subject}
                      onChange={(e) => updateSequence(index, 'subject', e.target.value)}
                      placeholder="e.g., Quick question about {{company}}"
                      className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use {'{{first_name}}'}, {'{{company}}'}, etc. for personalization
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-foreground">
                        Email Body
                      </label>
                      <button
                        type="button"
                        onClick={() => checkSpamRisk(index)}
                        disabled={spamChecking || !seq.subject || !seq.body}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300 rounded hover:bg-orange-200 dark:hover:bg-orange-500/30 disabled:opacity-50"
                      >
                        {spamChecking ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        Check Spam Risk
                      </button>
                    </div>
                    <textarea
                      value={seq.body}
                      onChange={(e) => updateSequence(index, 'body', e.target.value)}
                      placeholder="Hi {{first_name}},&#10;&#10;I noticed that..."
                      rows={6}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/campaigns"
            className="px-4 py-2 text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !name}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Create Campaign
              </>
            )}
          </button>
        </div>
      </form>

      {/* AI Campaign Generator Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-primary to-purple-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">AI Campaign Generator</h2>
                    <p className="text-sm text-muted-foreground">Generate a complete email sequence</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAIModal(false)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Product/Service Description *
                </label>
                <textarea
                  value={aiProductDescription}
                  onChange={(e) => setAiProductDescription(e.target.value)}
                  placeholder="Describe what you're selling or offering..."
                  rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Target Audience *
                </label>
                <input
                  type="text"
                  value={aiTargetAudience}
                  onChange={(e) => setAiTargetAudience(e.target.value)}
                  placeholder="e.g., SaaS founders, Marketing Directors, Small business owners"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Tone
                </label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value as typeof aiTone)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="friendly">Friendly</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Your Name (optional)
                  </label>
                  <input
                    type="text"
                    value={aiSenderName}
                    onChange={(e) => setAiSenderName(e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Company Name (optional)
                  </label>
                  <input
                    type="text"
                    value={aiCompanyName}
                    onChange={(e) => setAiCompanyName(e.target.value)}
                    placeholder="Acme Inc"
                    className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>This will generate:</strong> 1 initial email + 2 follow-ups + 1 breakup email.
                  All emails will use personalization variables like {'{{first_name}}'} and {'{{company}}'}.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAIModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={generateAICampaign}
                disabled={aiGenerating || !aiProductDescription || !aiTargetAudience}
                className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 disabled:opacity-50"
              >
                {aiGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate Campaign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spam Check Results Modal */}
      {spamResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {spamResults.riskLevel === 'low' ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  ) : spamResults.riskLevel === 'medium' ? (
                    <AlertCircle className="w-8 h-8 text-yellow-500" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Spam Risk: {spamResults.riskLevel.toUpperCase()}
                    </h2>
                    <p className="text-sm text-muted-foreground">Score: {spamResults.score}/100</p>
                  </div>
                </div>
                <button
                  onClick={() => setSpamResults(null)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {spamResults.issues.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Issues Found:</p>
                  <ul className="space-y-1">
                    {spamResults.issues.map((issue, i) => (
                      <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                        <span className="text-red-400 dark:text-red-500 mt-0.5">-</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {spamResults.suggestions.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Suggestions:</p>
                  <ul className="space-y-1">
                    {spamResults.suggestions.map((suggestion, i) => (
                      <li key={i} className="text-sm text-blue-600 dark:text-blue-400 flex items-start gap-2">
                        <span className="text-blue-400 dark:text-blue-500 mt-0.5">+</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {spamResults.rewrittenVersion && (
                <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">AI Suggested Rewrite:</p>
                  <p className="text-sm text-green-700 dark:text-green-400 whitespace-pre-wrap">
                    {spamResults.rewrittenVersion.substring(0, 300)}...
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSpamResults(null)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
              {spamResults.rewrittenVersion && (
                <button
                  type="button"
                  onClick={applySpamSuggestion}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Apply Suggestion
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
