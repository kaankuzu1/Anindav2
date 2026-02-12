'use client';

import { useState, useEffect, useRef, createRef, RefObject, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { aiClient } from '@/lib/ai/client';
import { ArrowLeft, Plus, Trash2, Clock, Mail, Users, Inbox, Sparkles, Wand2, RefreshCw, AlertCircle, CheckCircle2, X, FlaskConical, ChevronDown, ChevronUp, Copy, Eye, Braces, Info, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VariablePalette } from '@/components/shared/variable-palette';
import { EmailPreviewModal } from '@/components/shared/email-preview-modal';
import { CampaignScheduler } from '@/components/campaigns/campaign-scheduler';
import type { ScheduleData } from '@/components/campaigns/time-interval-slider';

interface SequenceVariant {
  id: string;
  name: string;
  subject: string;
  body: string;
  weight: number;
  smart_template_enabled: boolean;
  smart_template_tone_enabled: boolean;
  smart_template_tone: string;
  smart_template_language_match: boolean;
  smart_template_notes: string;
}

interface Sequence {
  step_number: number;
  delay_days: number;
  delay_hours: number;
  subject: string;
  body: string;
  variants: SequenceVariant[];
  showVariants: boolean;
  smart_template_enabled: boolean;
  smart_template_tone_enabled: boolean;
  smart_template_tone: string;
  smart_template_language_match: boolean;
  smart_template_notes: string;
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
  from_name?: string | null;
  sender_first_name?: string | null;
  sender_last_name?: string | null;
  sender_company?: string | null;
  sender_title?: string | null;
  sender_phone?: string | null;
  sender_website?: string | null;
}

const SMART_TEMPLATE_TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'persuasive', label: 'Persuasive' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'empathetic', label: 'Empathetic' },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const supabase = createClient();

  const { teamId, loading: teamLoading, accessToken } = useTeam();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLeadList, setSelectedLeadList] = useState<string>('');
  const [selectedInboxes, setSelectedInboxes] = useState<string[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([
    { step_number: 1, delay_days: 0, delay_hours: 0, subject: '', body: '', variants: [], showVariants: false, smart_template_enabled: false, smart_template_tone_enabled: false, smart_template_tone: 'professional', smart_template_language_match: true, smart_template_notes: '' },
  ]);
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

  // Options
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);

  // Test Email State
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [testLeadData, setTestLeadData] = useState({
    first_name: '', last_name: '', company: '', title: '', analysis_notes: '', country: '',
  });
  const [testInboxId, setTestInboxId] = useState('');
  const [testStepIndex, setTestStepIndex] = useState(0);
  const [testVariantId, setTestVariantId] = useState<string | null>(null);
  const [testPreview, setTestPreview] = useState<{ subject: string; body: string } | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testPreviewing, setTestPreviewing] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sent' | 'failed'>('idle');
  const [testError, setTestError] = useState('');

  // AI State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProductDescription, setAiProductDescription] = useState('');
  const [aiTargetAudience, setAiTargetAudience] = useState('');
  const [aiTone, setAiTone] = useState<'professional' | 'casual' | 'friendly' | 'urgent'>('professional');
  const [aiSenderName, setAiSenderName] = useState('');
  const [aiCompanyName, setAiCompanyName] = useState('');

  // AI Follow-up State
  const [aiFollowUpGenerating, setAiFollowUpGenerating] = useState<number | null>(null);

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

  // Template Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewStepIndex, setPreviewStepIndex] = useState(0);

  // Variable Palette State
  const [variablePaletteOpen, setVariablePaletteOpen] = useState<Set<string>>(new Set());
  const bodyTextareaRefs = useRef<RefObject<HTMLTextAreaElement | null>[]>([]);
  const variantBodyTextareaRefs = useRef<Map<string, RefObject<HTMLTextAreaElement | null>>>(new Map());
  const testEmailRef = useRef<HTMLDivElement>(null);

  const getVariantTextareaRef = (variantId: string): RefObject<HTMLTextAreaElement | null> => {
    if (!variantBodyTextareaRefs.current.has(variantId)) {
      variantBodyTextareaRefs.current.set(variantId, createRef<HTMLTextAreaElement>());
    }
    return variantBodyTextareaRefs.current.get(variantId)!;
  };

  // Sample lead data for preview
  const sampleLead = {
    first_name: 'John',
    last_name: 'Smith',
    email: 'john.smith@example.com',
    company: 'Acme Inc',
    title: 'VP of Sales',
    phone: '+1 555-123-4567',
  };

  // Fetch team options when teamId is available
  useEffect(() => {
    if (teamLoading || !teamId) return;

    async function fetchData() {
      setLoading(true);

      // Fetch lead lists
      const { data: lists } = await supabase
        .from('lead_lists')
        .select('id, name, lead_count')
        .eq('team_id', teamId!)
        .order('created_at', { ascending: false });

      setLeadLists(lists ?? []);

      // Fetch active inboxes
      const { data: inboxData } = await supabase
        .from('inboxes')
        .select('id, email, provider, status, from_name, sender_first_name, sender_last_name, sender_company, sender_title, sender_phone, sender_website')
        .eq('team_id', teamId!)
        .in('status', ['active', 'warming_up']);

      setInboxes(inboxData ?? []);

      setLoading(false);
    }

    fetchData();
  }, [teamId, teamLoading]);

  const addSequence = () => {
    const lastSeq = sequences[sequences.length - 1];
    setSequences([
      ...sequences,
      {
        step_number: sequences.length + 1,
        delay_days: 3,
        delay_hours: 0,
        subject: lastSeq?.subject ? `Re: ${lastSeq.subject.replace(/^Re:\s*/i, '')}` : '',
        body: '',
        variants: [],
        showVariants: false,
        smart_template_enabled: false,
        smart_template_tone_enabled: false,
        smart_template_tone: 'professional',
        smart_template_language_match: true,
        smart_template_notes: '',
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

  const updateSequence = (index: number, field: keyof Sequence, value: string | number | boolean | SequenceVariant[]) => {
    const updated = [...sequences];
    updated[index] = { ...updated[index], [field]: value };
    setSequences(updated);
  };

  // A/B Testing Functions
  const generateVariantId = () => `variant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addVariant = (seqIndex: number) => {
    const seq = sequences[seqIndex];
    const variantCount = seq.variants.length;
    const newVariant: SequenceVariant = {
      id: generateVariantId(),
      name: `Variant ${String.fromCharCode(66 + variantCount)}`, // B, C, D...
      subject: seq.subject,
      body: seq.body,
      weight: Math.floor(100 / (variantCount + 2)), // Equal distribution
      smart_template_enabled: false,
      smart_template_tone_enabled: false,
      smart_template_tone: 'professional',
      smart_template_language_match: true,
      smart_template_notes: '',
    };

    // Recalculate weights for existing variants
    const totalVariants = variantCount + 2; // Original + existing + new
    const equalWeight = Math.floor(100 / totalVariants);
    const updatedVariants = seq.variants.map((v) => ({ ...v, weight: equalWeight }));

    const updated = [...sequences];
    updated[seqIndex] = {
      ...seq,
      variants: [...updatedVariants, { ...newVariant, weight: equalWeight }],
      showVariants: true,
    };
    setSequences(updated);
  };

  const removeVariant = (seqIndex: number, variantId: string) => {
    const seq = sequences[seqIndex];
    const updatedVariants = seq.variants.filter((v) => v.id !== variantId);

    // Recalculate weights
    const totalVariants = updatedVariants.length + 1; // Original + remaining
    const equalWeight = Math.floor(100 / totalVariants);
    const reweightedVariants = updatedVariants.map((v) => ({ ...v, weight: equalWeight }));

    const updated = [...sequences];
    updated[seqIndex] = { ...seq, variants: reweightedVariants };
    setSequences(updated);

    // Clean up variant refs and palette state
    variantBodyTextareaRefs.current.delete(variantId);
    const nextPalette = new Set(variablePaletteOpen);
    nextPalette.delete(`variant-${variantId}`);
    setVariablePaletteOpen(nextPalette);

    // Reset test variant if it was the removed one
    if (testVariantId === variantId) setTestVariantId(null);
  };

  const updateVariant = (seqIndex: number, variantId: string, field: keyof SequenceVariant, value: string | number) => {
    const seq = sequences[seqIndex];
    const updatedVariants = seq.variants.map((v) =>
      v.id === variantId ? { ...v, [field]: value } : v
    );

    const updated = [...sequences];
    updated[seqIndex] = { ...seq, variants: updatedVariants };
    setSequences(updated);
  };

  const toggleVariants = (seqIndex: number) => {
    const updated = [...sequences];
    updated[seqIndex] = { ...updated[seqIndex], showVariants: !updated[seqIndex].showVariants };
    setSequences(updated);
  };

  const duplicateAsVariant = (seqIndex: number) => {
    const seq = sequences[seqIndex];
    if (seq.variants.length >= 3) {
      alert('Maximum 4 variants (A, B, C, D) allowed per step');
      return;
    }
    addVariant(seqIndex);
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
          variants: [],
          showVariants: false,
          smart_template_enabled: false,
          smart_template_tone_enabled: false,
          smart_template_tone: 'professional',
          smart_template_language_match: true,
          smart_template_notes: '',
        },
        {
          step_number: 2,
          delay_days: 2,
          delay_hours: 0,
          subject: `Re: ${result.subject}`,
          body: result.followUp1,
          variants: [],
          showVariants: false,
          smart_template_enabled: false,
          smart_template_tone_enabled: false,
          smart_template_tone: 'professional',
          smart_template_language_match: true,
          smart_template_notes: '',
        },
        {
          step_number: 3,
          delay_days: 4,
          delay_hours: 0,
          subject: `Re: ${result.subject}`,
          body: result.followUp2,
          variants: [],
          showVariants: false,
          smart_template_enabled: false,
          smart_template_tone_enabled: false,
          smart_template_tone: 'professional',
          smart_template_language_match: true,
          smart_template_notes: '',
        },
        {
          step_number: 4,
          delay_days: 7,
          delay_hours: 0,
          subject: `Last chance: ${result.subject}`,
          body: result.breakupEmail,
          variants: [],
          showVariants: false,
          smart_template_enabled: false,
          smart_template_tone_enabled: false,
          smart_template_tone: 'professional',
          smart_template_language_match: true,
          smart_template_notes: '',
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

  // AI Follow-up Generation
  const handleAIFollowUp = async (stepIndex: number) => {
    if (!accessToken || stepIndex < 1) return;
    setAiFollowUpGenerating(stepIndex);
    try {
      const originalEmail = sequences[0].body;
      const previousFollowUps = sequences.slice(1, stepIndex).map(s => s.body);
      const daysSinceLastEmail = sequences[stepIndex].delay_days || 3;
      const result = await aiClient.generateFollowUp(originalEmail, previousFollowUps, daysSinceLastEmail, accessToken);
      updateSequence(stepIndex, 'subject', result.subject);
      updateSequence(stepIndex, 'body', result.body);
    } catch (err) {
      console.error('AI follow-up generation failed:', err);
    } finally {
      setAiFollowUpGenerating(null);
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

  // Template Preview Functions
  const openPreview = (stepIndex: number) => {
    setPreviewStepIndex(stepIndex);
    setShowPreviewModal(true);
  };

  // Quick test variant from step/variant card
  const testVariant = (stepIndex: number, variantId: string | null) => {
    setTestStepIndex(stepIndex);
    setTestVariantId(variantId);
    setShowTestEmail(true);
    setTestPreview(null);
    setTestStatus('idle');
    setTestError('');
    setTimeout(() => testEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  // Test Email Functions
  const handleTestPreview = async () => {
    if (!teamId) return;
    const seq = sequences[testStepIndex];
    if (!seq) return;

    const selectedVariant = testVariantId ? seq.variants.find(v => v.id === testVariantId) : null;
    const testSubject = selectedVariant?.subject ?? seq.subject;
    const testBody = selectedVariant?.body ?? seq.body;
    const testSmartEnabled = selectedVariant?.smart_template_enabled ?? seq.smart_template_enabled;
    const testSmartToneEnabled = selectedVariant?.smart_template_tone_enabled ?? seq.smart_template_tone_enabled;
    const testSmartTone = selectedVariant?.smart_template_tone ?? seq.smart_template_tone;
    const testSmartLangMatch = selectedVariant?.smart_template_language_match ?? seq.smart_template_language_match;
    const testSmartNotes = selectedVariant?.smart_template_notes ?? seq.smart_template_notes;

    setTestPreviewing(true);
    setTestError('');
    setTestStatus('idle');
    setTestPreview(null);

    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      const res = await fetch(`${apiUrl}/campaigns/preview-test?team_id=${teamId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          subject: testSubject,
          body: testBody,
          smartTemplateEnabled: testSmartEnabled,
          smartTemplateToneEnabled: testSmartToneEnabled,
          smartTemplateTone: testSmartTone,
          smartTemplateLanguageMatch: testSmartLangMatch,
          smartTemplateNotes: testSmartNotes,
          testLead: testLeadData,
          inboxId: testInboxId || selectedInboxes[0] || '',
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        throw new Error(text || 'Failed to preview');
      }

      if (!res.ok) throw new Error(data?.message || 'Preview failed');
      setTestPreview(data);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Preview failed');
      setTestStatus('failed');
    } finally {
      setTestPreviewing(false);
    }
  };

  const handleTestSend = async () => {
    if (!teamId || !testRecipientEmail) return;
    const seq = sequences[testStepIndex];
    if (!seq) return;

    const selectedVariant = testVariantId ? seq.variants.find(v => v.id === testVariantId) : null;
    const testSubject = selectedVariant?.subject ?? seq.subject;
    const testBody = selectedVariant?.body ?? seq.body;
    const testSmartEnabled = selectedVariant?.smart_template_enabled ?? seq.smart_template_enabled;
    const testSmartToneEnabled = selectedVariant?.smart_template_tone_enabled ?? seq.smart_template_tone_enabled;
    const testSmartTone = selectedVariant?.smart_template_tone ?? seq.smart_template_tone;
    const testSmartLangMatch = selectedVariant?.smart_template_language_match ?? seq.smart_template_language_match;
    const testSmartNotes = selectedVariant?.smart_template_notes ?? seq.smart_template_notes;

    setTestSending(true);
    setTestError('');
    setTestStatus('idle');

    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      const res = await fetch(`${apiUrl}/campaigns/send-test?team_id=${teamId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          subject: testSubject,
          body: testBody,
          smartTemplateEnabled: testSmartEnabled,
          smartTemplateToneEnabled: testSmartToneEnabled,
          smartTemplateTone: testSmartTone,
          smartTemplateLanguageMatch: testSmartLangMatch,
          smartTemplateNotes: testSmartNotes,
          testLead: testLeadData,
          inboxId: testInboxId || selectedInboxes[0] || '',
          recipientEmail: testRecipientEmail,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        throw new Error(text || 'Failed to send');
      }

      if (!res.ok) throw new Error(data?.message || 'Send failed');
      setTestPreview({ subject: data.subject, body: data.body });
      setTestStatus('sent');
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Send failed');
      setTestStatus('failed');
    } finally {
      setTestSending(false);
    }
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
          settings: (() => {
            const allIntervals = Object.values(scheduleData.schedule).flat().filter(Boolean);
            const earliestStart = allIntervals.length > 0 ? Math.min(...allIntervals.map(i => i!.start)) : 9;
            const latestEnd = allIntervals.length > 0 ? Math.max(...allIntervals.map(i => i!.end)) : 17;
            return {
              schedule: scheduleData.schedule,
              timezone: scheduleData.timezone,
              send_days: Object.keys(scheduleData.schedule),
              send_window_start: `${String(earliestStart).padStart(2, '0')}:00`,
              send_window_end: `${String(latestEnd).padStart(2, '0')}:00`,
              stop_on_reply: stopOnReply,
              track_opens: true,
            };
          })(),
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
        smart_template_enabled: seq.smart_template_enabled,
        smart_template_tone_enabled: seq.smart_template_tone_enabled,
        smart_template_tone: seq.smart_template_tone,
        smart_template_language_match: seq.smart_template_language_match,
        smart_template_notes: seq.smart_template_notes || null,
      }));

      const { data: createdSequences, error: seqError } = await (supabase
        .from('sequences') as any)
        .insert(sequenceInserts)
        .select('id, step_number');

      if (seqError) throw seqError;

      // Create variants for sequences that have them
      const variantInserts: {
        sequence_id: string;
        variant_index: number;
        variant_name: string;
        subject: string;
        body: string;
        weight: number;
        smart_template_enabled: boolean;
        smart_template_tone_enabled: boolean;
        smart_template_tone: string;
        smart_template_language_match: boolean;
        smart_template_notes: string | null;
      }[] = [];

      sequences.forEach((seq) => {
        const createdSeq = createdSequences?.find((cs: any) => cs.step_number === seq.step_number);
        if (!createdSeq) return;

        // Add original as Variant A
        if (seq.variants.length > 0) {
          const totalVariants = seq.variants.length + 1;
          const originalWeight = Math.floor(100 / totalVariants);

          variantInserts.push({
            sequence_id: createdSeq.id,
            variant_index: 0,
            variant_name: 'Variant A',
            subject: seq.subject,
            body: seq.body,
            weight: originalWeight,
            smart_template_enabled: seq.smart_template_enabled,
            smart_template_tone_enabled: seq.smart_template_tone_enabled,
            smart_template_tone: seq.smart_template_tone,
            smart_template_language_match: seq.smart_template_language_match,
            smart_template_notes: seq.smart_template_notes || null,
          });

          // Add other variants
          seq.variants.forEach((variant, vIdx) => {
            variantInserts.push({
              sequence_id: createdSeq.id,
              variant_index: vIdx + 1,
              variant_name: variant.name,
              subject: variant.subject,
              body: variant.body,
              weight: variant.weight,
              smart_template_enabled: variant.smart_template_enabled,
              smart_template_tone_enabled: variant.smart_template_tone_enabled,
              smart_template_tone: variant.smart_template_tone,
              smart_template_language_match: variant.smart_template_language_match,
              smart_template_notes: variant.smart_template_notes || null,
            });
          });
        }
      });

      if (variantInserts.length > 0) {
        const { error: variantError } = await (supabase
          .from('sequence_variants') as any)
          .insert(variantInserts);

        if (variantError) {
          console.error('Failed to create variants:', variantError);
          // Don't throw - campaign is still created
        }
      }

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

  if (loading || teamLoading) {
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
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
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
              <span className="text-sm font-medium text-foreground">Stop on reply</span>
              <div className="relative group">
                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-foreground text-background text-xs rounded-lg w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none z-10">
                  When enabled, the campaign will stop sending follow-up emails to a lead once they reply. This allows you to respond personally from the Unibox.
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                </div>
              </div>
            </div>
          </div>

          <div>
            {sequences.map((seq, index) => (
              <Fragment key={index}>
                {/* Delay connector between steps */}
                {index > 0 && (
                  <div className="flex flex-col items-center py-1">
                    <div className="w-px h-4 bg-border" />
                    <div className="flex items-center gap-2 px-4 py-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Wait</span>
                      {[1, 3, 5].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => {
                            const updated = [...sequences];
                            updated[index] = { ...updated[index], delay_days: days, delay_hours: 0 };
                            setSequences(updated);
                          }}
                          className={cn(
                            'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                            seq.delay_days === days && seq.delay_hours === 0
                              ? 'bg-primary text-white border-primary'
                              : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                          )}
                        >
                          {days} day{days > 1 ? 's' : ''}
                        </button>
                      ))}
                      {/* Show custom badge for non-preset delays */}
                      {![1, 3, 5].includes(seq.delay_days) || seq.delay_hours > 0 ? (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary text-white border border-primary">
                          {seq.delay_days}d{seq.delay_hours > 0 ? ` ${seq.delay_hours}h` : ''}
                        </span>
                      ) : null}
                    </div>
                    <div className="w-px h-4 bg-border" />
                  </div>
                )}

                <div className={cn('p-6', index > 0 && 'border-t border-border')}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{seq.step_number}</span>
                  </div>
                  <h3 className="font-medium text-foreground">Step {seq.step_number}</h3>

                  {sequences.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSequence(index)}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg ml-auto"
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
                      Use double braces for variables: {'{{first_name}}'}, {'{{company}}'}. Single braces {'{option1|option2}'} are for spintax only.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-foreground">
                        Email Body
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const key = `step-${index}`;
                            const next = new Set(variablePaletteOpen);
                            if (next.has(key)) { next.delete(key); } else { next.add(key); }
                            setVariablePaletteOpen(next);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                            variablePaletteOpen.has(`step-${index}`)
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500/30'
                          }`}
                        >
                          <Braces className="w-3 h-3" />
                          Variables
                        </button>
                        <button
                          type="button"
                          onClick={() => openPreview(index)}
                          disabled={!seq.subject && !seq.body}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-500/30 disabled:opacity-50"
                        >
                          <Eye className="w-3 h-3" />
                          Preview
                        </button>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAIFollowUp(index)}
                            disabled={aiFollowUpGenerating === index}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-500/30 disabled:opacity-50"
                          >
                            <Wand2 className="w-3 h-3" />
                            {aiFollowUpGenerating === index ? 'Generating...' : 'AI Follow-up'}
                          </button>
                        )}
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
                    </div>
                    <textarea
                      ref={(() => {
                        if (!bodyTextareaRefs.current[index]) {
                          bodyTextareaRefs.current[index] = createRef<HTMLTextAreaElement>();
                        }
                        return bodyTextareaRefs.current[index] as React.RefObject<HTMLTextAreaElement>;
                      })()}
                      value={seq.body}
                      onChange={(e) => updateSequence(index, 'body', e.target.value)}
                      placeholder="{Hi|Hello} {{first_name}},&#10;&#10;I noticed that {{company}}..."
                      rows={6}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                    />
                    {variablePaletteOpen.has(`step-${index}`) && teamId && (
                      <div className="mt-2 p-3 border border-border rounded-lg bg-muted/30">
                        <VariablePalette
                          teamId={teamId}
                          lead={null}
                          inbox={selectedInboxes.length > 0 ? inboxes.find(i => i.id === selectedInboxes[0]) || null : null}
                          originalSubject={null}
                          textareaRef={bodyTextareaRefs.current[index] || { current: null }}
                          onInsert={(newText) => updateSequence(index, 'body', newText)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Smart Template Section */}
                  <div className="space-y-2">
                    <div className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      seq.smart_template_enabled
                        ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30'
                        : 'bg-muted/30 border-border'
                    )}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={seq.smart_template_enabled}
                        onClick={() => updateSequence(index, 'smart_template_enabled', !seq.smart_template_enabled)}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                          seq.smart_template_enabled ? 'bg-violet-600' : 'bg-muted-foreground/30'
                        )}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                            seq.smart_template_enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                      <Sparkles className={cn('w-4 h-4', seq.smart_template_enabled ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground')} />
                      <span className={cn('text-sm font-medium', seq.smart_template_enabled ? 'text-violet-900 dark:text-violet-200' : 'text-foreground')}>
                        Smart Template
                      </span>
                      {seq.smart_template_enabled && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateSequence(index, 'smart_template_tone_enabled', !seq.smart_template_tone_enabled)}
                            className={cn(
                              'ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors',
                              seq.smart_template_tone_enabled
                                ? 'bg-violet-100 dark:bg-violet-500/20 border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300'
                                : 'bg-muted/50 border-border text-muted-foreground'
                            )}
                          >
                            <span className={cn(
                              'relative inline-flex h-3.5 w-6 shrink-0 rounded-full transition-colors duration-200',
                              seq.smart_template_tone_enabled ? 'bg-violet-600' : 'bg-muted-foreground/30'
                            )}>
                              <span className={cn(
                                'pointer-events-none inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                                seq.smart_template_tone_enabled ? 'translate-x-[10px]' : 'translate-x-0.5'
                              )} />
                            </span>
                            Tone
                          </button>
                          {seq.smart_template_tone_enabled && (
                            <select
                              value={seq.smart_template_tone}
                              onChange={(e) => updateSequence(index, 'smart_template_tone', e.target.value)}
                              className="px-3 py-1 text-sm border border-violet-200 dark:border-violet-500/30 rounded-lg bg-white dark:bg-card text-foreground focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                            >
                              {SMART_TEMPLATE_TONES.map((tone) => (
                                <option key={tone.value} value={tone.value}>{tone.label}</option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => updateSequence(index, 'smart_template_language_match', !seq.smart_template_language_match)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors',
                              seq.smart_template_language_match
                                ? 'bg-violet-100 dark:bg-violet-500/20 border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300'
                                : 'bg-muted/50 border-border text-muted-foreground'
                            )}
                          >
                            <span className={cn(
                              'relative inline-flex h-3.5 w-6 shrink-0 rounded-full transition-colors duration-200',
                              seq.smart_template_language_match ? 'bg-violet-600' : 'bg-muted-foreground/30'
                            )}>
                              <span className={cn(
                                'pointer-events-none inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                                seq.smart_template_language_match ? 'translate-x-[10px]' : 'translate-x-0.5'
                              )} />
                            </span>
                            Match language
                          </button>
                          <div className="relative group">
                            <Info className="w-4 h-4 text-violet-400 dark:text-violet-500 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-foreground text-background text-xs rounded-lg w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none z-10">
                              AI will personalize this template for each lead at send time
                              <span className="absolute top-full right-4 border-4 border-transparent border-t-foreground" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {seq.smart_template_enabled && (
                      <textarea
                        value={seq.smart_template_notes}
                        onChange={(e) => updateSequence(index, 'smart_template_notes', e.target.value)}
                        placeholder="Optional: AI instructions for personalizing this step (e.g., 'Focus on their recent funding round', 'Mention our integration with their tech stack')"
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-violet-200 dark:border-violet-500/30 rounded-lg bg-white dark:bg-card text-foreground placeholder:text-violet-400/60 dark:placeholder:text-violet-500/40 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      />
                    )}
                  </div>

                  {/* A/B Testing Section */}
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-medium text-foreground">A/B Testing</span>
                        {seq.variants.length > 0 && (
                          <span className="text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                            {seq.variants.length + 1} variants
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {seq.variants.length > 0 && (
                          <button
                            type="button"
                            onClick={() => testVariant(index, null)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            title="Test original (Variant A)"
                          >
                            <Send className="w-3 h-3" />
                            Test A
                          </button>
                        )}
                        {seq.variants.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleVariants(index)}
                            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            {seq.showVariants ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Show
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => duplicateAsVariant(index)}
                          disabled={seq.variants.length >= 3}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-500/30 disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                          Add Variant
                        </button>
                      </div>
                    </div>

                    {/* Variant Weight Display */}
                    {seq.variants.length > 0 && (
                      <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-muted-foreground">Traffic Split:</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1 text-xs">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            <span className="text-foreground">A: {Math.floor(100 / (seq.variants.length + 1))}%</span>
                          </div>
                          {seq.variants.map((v, i) => (
                            <div key={v.id} className="flex items-center gap-1 text-xs">
                              <span className={`w-3 h-3 rounded-full ${['bg-green-500', 'bg-orange-500', 'bg-pink-500'][i]}`}></span>
                              <span className="text-foreground">{v.name.split(' ')[1]}: {v.weight}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Variant List */}
                    {seq.showVariants && seq.variants.length > 0 && (
                      <div className="space-y-4">
                        {seq.variants.map((variant, vIndex) => (
                          <div
                            key={variant.id}
                            className={`p-4 border rounded-lg ${['border-green-300 dark:border-green-500/30 bg-green-50/50 dark:bg-green-500/5', 'border-orange-300 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/5', 'border-pink-300 dark:border-pink-500/30 bg-pink-50/50 dark:bg-pink-500/5'][vIndex]}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${['bg-green-500', 'bg-orange-500', 'bg-pink-500'][vIndex]}`}></span>
                                <span className="font-medium text-foreground">{variant.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => testVariant(index, variant.id)}
                                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                  title="Test this variant"
                                >
                                  <Send className="w-3 h-3" />
                                  Test
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateVariant(index, variant.id, 'subject', seq.subject);
                                    updateVariant(index, variant.id, 'body', seq.body);
                                  }}
                                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                  title="Copy from original"
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy A
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeVariant(index, variant.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
                                <input
                                  type="text"
                                  value={variant.subject}
                                  onChange={(e) => updateVariant(index, variant.id, 'subject', e.target.value)}
                                  placeholder="Subject line for this variant"
                                  className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground"
                                />
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-xs font-medium text-muted-foreground">Body</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const key = `variant-${variant.id}`;
                                      const next = new Set(variablePaletteOpen);
                                      if (next.has(key)) { next.delete(key); } else { next.add(key); }
                                      setVariablePaletteOpen(next);
                                    }}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${
                                      variablePaletteOpen.has(`variant-${variant.id}`)
                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500/30'
                                    }`}
                                  >
                                    <Braces className="w-3 h-3" />
                                    Variables
                                  </button>
                                </div>
                                <textarea
                                  ref={getVariantTextareaRef(variant.id) as React.RefObject<HTMLTextAreaElement>}
                                  value={variant.body}
                                  onChange={(e) => updateVariant(index, variant.id, 'body', e.target.value)}
                                  placeholder="Email body for this variant"
                                  rows={4}
                                  className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground font-mono"
                                />
                                {variablePaletteOpen.has(`variant-${variant.id}`) && teamId && (
                                  <div className="mt-2 p-3 border border-border rounded-lg bg-muted/30">
                                    <VariablePalette
                                      teamId={teamId}
                                      lead={null}
                                      inbox={selectedInboxes.length > 0 ? inboxes.find(i => i.id === selectedInboxes[0]) || null : null}
                                      originalSubject={null}
                                      textareaRef={getVariantTextareaRef(variant.id) || { current: null }}
                                      onInsert={(newText) => updateVariant(index, variant.id, 'body', newText)}
                                    />
                                  </div>
                                )}
                              </div>
                              {/* Compact Smart Template for Variant */}
                              <div className="space-y-1.5">
                                <div className={cn(
                                  'flex items-center gap-2 p-2 rounded-lg border transition-colors',
                                  variant.smart_template_enabled
                                    ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30'
                                    : 'bg-muted/30 border-border'
                                )}>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={variant.smart_template_enabled}
                                    onClick={() => {
                                      const seq = sequences[index];
                                      const updatedVariants = seq.variants.map((v) =>
                                        v.id === variant.id ? { ...v, smart_template_enabled: !v.smart_template_enabled } : v
                                      );
                                      updateSequence(index, 'variants', updatedVariants);
                                    }}
                                    className={cn(
                                      'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                                      variant.smart_template_enabled ? 'bg-violet-600' : 'bg-muted-foreground/30'
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                                        variant.smart_template_enabled ? 'translate-x-[14px]' : 'translate-x-0.5'
                                      )}
                                    />
                                  </button>
                                  <Sparkles className={cn('w-3 h-3', variant.smart_template_enabled ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground')} />
                                  <span className={cn('text-xs font-medium', variant.smart_template_enabled ? 'text-violet-900 dark:text-violet-200' : 'text-muted-foreground')}>
                                    Smart Template
                                  </span>
                                  {variant.smart_template_enabled && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const seq = sequences[index];
                                          const updatedVariants = seq.variants.map((v) =>
                                            v.id === variant.id ? { ...v, smart_template_tone_enabled: !v.smart_template_tone_enabled } : v
                                          );
                                          updateSequence(index, 'variants', updatedVariants);
                                        }}
                                        className={cn(
                                          'ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border transition-colors',
                                          variant.smart_template_tone_enabled
                                            ? 'bg-violet-100 dark:bg-violet-500/20 border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300'
                                            : 'bg-muted/50 border-border text-muted-foreground'
                                        )}
                                      >
                                        <span className={cn(
                                          'relative inline-flex h-3 w-5 shrink-0 rounded-full transition-colors duration-200',
                                          variant.smart_template_tone_enabled ? 'bg-violet-600' : 'bg-muted-foreground/30'
                                        )}>
                                          <span className={cn(
                                            'pointer-events-none inline-block h-2 w-2 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                                            variant.smart_template_tone_enabled ? 'translate-x-[10px]' : 'translate-x-0.5'
                                          )} />
                                        </span>
                                        Tone
                                      </button>
                                      {variant.smart_template_tone_enabled && (
                                        <select
                                          value={variant.smart_template_tone}
                                          onChange={(e) => {
                                            const seq = sequences[index];
                                            const updatedVariants = seq.variants.map((v) =>
                                              v.id === variant.id ? { ...v, smart_template_tone: e.target.value } : v
                                            );
                                            updateSequence(index, 'variants', updatedVariants);
                                          }}
                                          className="px-2 py-0.5 text-xs border border-violet-200 dark:border-violet-500/30 rounded bg-white dark:bg-card text-foreground focus:ring-1 focus:ring-violet-500/20"
                                        >
                                          {SMART_TEMPLATE_TONES.map((tone) => (
                                            <option key={tone.value} value={tone.value}>{tone.label}</option>
                                          ))}
                                        </select>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const seq = sequences[index];
                                          const updatedVariants = seq.variants.map((v) =>
                                            v.id === variant.id ? { ...v, smart_template_language_match: !v.smart_template_language_match } : v
                                          );
                                          updateSequence(index, 'variants', updatedVariants);
                                        }}
                                        className={cn(
                                          'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border transition-colors',
                                          variant.smart_template_language_match
                                            ? 'bg-violet-100 dark:bg-violet-500/20 border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300'
                                            : 'bg-muted/50 border-border text-muted-foreground'
                                        )}
                                      >
                                        <span className={cn(
                                          'relative inline-flex h-3 w-5 shrink-0 rounded-full transition-colors duration-200',
                                          variant.smart_template_language_match ? 'bg-violet-600' : 'bg-muted-foreground/30'
                                        )}>
                                          <span className={cn(
                                            'pointer-events-none inline-block h-2 w-2 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                                            variant.smart_template_language_match ? 'translate-x-[10px]' : 'translate-x-0.5'
                                          )} />
                                        </span>
                                        Lang
                                      </button>
                                    </>
                                  )}
                                </div>
                                {variant.smart_template_enabled && (
                                  <textarea
                                    value={variant.smart_template_notes}
                                    onChange={(e) => {
                                      const seq = sequences[index];
                                      const updatedVariants = seq.variants.map((v) =>
                                        v.id === variant.id ? { ...v, smart_template_notes: e.target.value } : v
                                      );
                                      updateSequence(index, 'variants', updatedVariants);
                                    }}
                                    placeholder="Optional: AI instructions for this variant..."
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 text-xs border border-violet-200 dark:border-violet-500/30 rounded-lg bg-white dark:bg-card text-foreground placeholder:text-violet-400/60 dark:placeholder:text-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {seq.variants.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Add variants to test different subject lines or email content. Traffic will be split evenly.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              </Fragment>
            ))}
          </div>
        </div>

        {/* Test Email */}
        <div ref={testEmailRef} className="bg-card rounded-xl border border-border overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => setShowTestEmail(!showTestEmail)}
            className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-foreground">Test Email</h3>
                <p className="text-xs text-muted-foreground">Preview and send a test before launching</p>
              </div>
            </div>
            {showTestEmail ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showTestEmail && (
            <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
              {/* Step selector + Variant + Inbox */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sequence Step</label>
                  <select
                    value={testStepIndex}
                    onChange={(e) => { setTestStepIndex(Number(e.target.value)); setTestVariantId(null); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                  >
                    {sequences.map((seq, i) => (
                      <option key={i} value={i}>Step {seq.step_number}: {seq.subject || '(no subject)'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Send From Inbox</label>
                  <select
                    value={testInboxId || selectedInboxes[0] || ''}
                    onChange={(e) => setTestInboxId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                  >
                    <option value="">Select inbox...</option>
                    {inboxes.map((inbox) => (
                      <option key={inbox.id} value={inbox.id}>{inbox.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Variant selector (only when step has variants) */}
              {sequences[testStepIndex]?.variants.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    <FlaskConical className="w-3 h-3 inline mr-1" />
                    A/B Variant
                  </label>
                  <select
                    value={testVariantId || ''}
                    onChange={(e) => setTestVariantId(e.target.value || null)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                  >
                    <option value="">Original (Variant A)</option>
                    {sequences[testStepIndex].variants.map(v => (
                      <option key={v.id} value={v.id}>{v.name}: {v.subject || '(no subject)'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipient email */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Recipient Email</label>
                <input
                  type="email"
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                />
              </div>

              {/* Test lead data */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Test Lead Data</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={testLeadData.first_name}
                    onChange={(e) => setTestLeadData({ ...testLeadData, first_name: e.target.value })}
                    placeholder="First Name"
                    className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                  />
                  <input
                    type="text"
                    value={testLeadData.last_name}
                    onChange={(e) => setTestLeadData({ ...testLeadData, last_name: e.target.value })}
                    placeholder="Last Name"
                    className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                  />
                  <input
                    type="text"
                    value={testLeadData.company}
                    onChange={(e) => setTestLeadData({ ...testLeadData, company: e.target.value })}
                    placeholder="Company"
                    className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                  />
                  <input
                    type="text"
                    value={testLeadData.title}
                    onChange={(e) => setTestLeadData({ ...testLeadData, title: e.target.value })}
                    placeholder="Title"
                    className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                  />
                  <input
                    type="text"
                    value={testLeadData.country}
                    onChange={(e) => setTestLeadData({ ...testLeadData, country: e.target.value })}
                    placeholder="Country"
                    className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                  />
                </div>
                <textarea
                  value={testLeadData.analysis_notes}
                  onChange={(e) => setTestLeadData({ ...testLeadData, analysis_notes: e.target.value })}
                  placeholder="Analysis notes about the test lead (optional, used for smart template personalization)"
                  rows={2}
                  className="mt-3 w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestPreview}
                  disabled={testPreviewing || !(testVariantId ? sequences[testStepIndex]?.variants.find(v => v.id === testVariantId)?.subject : sequences[testStepIndex]?.subject)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 disabled:opacity-50"
                >
                  {testPreviewing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  Preview
                </button>
                <button
                  type="button"
                  onClick={handleTestSend}
                  disabled={testSending || !testRecipientEmail || !(testInboxId || selectedInboxes[0])}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {testSending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Send Test
                </button>
              </div>

              {/* Status messages */}
              {testStatus === 'sent' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-300">Test email sent successfully!</span>
                </div>
              )}
              {testStatus === 'failed' && testError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-300">{testError}</span>
                </div>
              )}

              {/* Preview display */}
              {testPreview && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-muted/50 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">Subject:</span>
                    <p className="text-sm font-medium text-foreground">{testPreview.subject}</p>
                  </div>
                  <div className="p-4">
                    <span className="text-xs font-medium text-muted-foreground mb-2 block">Body:</span>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: testPreview.body }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Send Schedule */}
        <CampaignScheduler value={scheduleData} onChange={setScheduleData} />

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

      {/* Template Preview Modal */}
      <EmailPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        steps={sequences.map((seq) => ({
          subject: seq.subject,
          body: seq.body,
          stepNumber: seq.step_number,
          delayDays: seq.delay_days,
          delayHours: seq.delay_hours,
        }))}
        lead={sampleLead}
        inbox={selectedInboxes.length > 0 ? inboxes.find((i) => i.id === selectedInboxes[0]) ?? null : null}
        recipientEmail={sampleLead.email}
        recipientName={`${sampleLead.first_name} ${sampleLead.last_name}`}
        showSpintax
        isSampleData
      />
    </div>
  );
}
