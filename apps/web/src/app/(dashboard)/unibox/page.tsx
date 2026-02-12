'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { aiClient } from '@/lib/ai/client';
import { useKeyboardShortcuts, ShortcutAction } from '@/hooks/use-keyboard-shortcuts';
import { useNotifications } from '@/hooks/use-notifications';
import { ShortcutHelpModal } from '@/components/ui/shortcut-help-modal';
import { NotificationPermission } from '@/components/ui/notification-permission';
import { TemplateSelector } from '@/components/replies/template-selector';
import { ReplyComposer } from '@/components/replies/reply-composer';
import { IntentConfirmModal } from '@/components/replies/intent-confirm-modal';
import { useToast } from '@/components/ui/toast';
import {
  MessageSquare,
  Search,
  Mail,
  CheckCircle,
  Archive,
  User,
  Building2,
  Clock,
  Sparkles,
  AlertTriangle,
  Copy,
  RefreshCw,
  Brain,
  CheckSquare,
  Square,
  X,
  Keyboard,
  Send,
  ChevronDown,
} from 'lucide-react';

interface Reply {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_preview: string | null;
  body_html: string | null;
  body_text: string | null;
  intent: string | null;
  message_id: string | null;
  thread_id: string | null;
  is_read: boolean;
  is_archived: boolean;
  received_at: string;
  lead_id: string | null;
  campaign_id: string | null;
  leads: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    title?: string | null;
    phone?: string | null;
    custom_fields?: Record<string, unknown> | null;
  } | null;
  inboxes: {
    id: string;
    email: string;
    provider: string;
  } | null;
  campaigns: {
    id: string;
    name: string;
  } | null;
}

interface Inbox {
  id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'smtp';
  status: 'active' | 'paused' | 'error' | 'warming_up' | 'banned';
  health_score: number;
  from_name?: string | null;
  sender_first_name?: string | null;
  sender_last_name?: string | null;
  sender_company?: string | null;
  sender_title?: string | null;
  sender_phone?: string | null;
  sender_website?: string | null;
}

type ViewMode = 'inbox' | 'sent';

function ViewSelector({
  value,
  onChange
}: {
  value: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ViewMode)}
        className="appearance-none bg-background border border-input rounded-md px-4 py-2 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
      >
        <option value="inbox">📥 Inbox</option>
        <option value="sent">📤 Sent</option>
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
    </div>
  );
}

export default function UniboxPage() {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  const { teamId, loading: teamLoading, accessToken } = useTeam();

  const [loading, setLoading] = useState(true);
  const [inboxesLoading, setInboxesLoading] = useState(true);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [selectedReply, setSelectedReply] = useState<Reply | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'interested' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // View mode (inbox or sent)
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');

  // Sent replies state
  const [sentReplies, setSentReplies] = useState<any[]>([]);
  const [selectedSent, setSelectedSent] = useState<any | null>(null);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentError, setSentError] = useState<string | null>(null);

  // Inboxes for sending
  const [inboxes, setInboxes] = useState<Inbox[]>([]);

  // Stats
  const [unreadCount, setUnreadCount] = useState(0);
  const [intentCounts, setIntentCounts] = useState<Record<string, number>>({});

  // Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = useState(true);
  const [composerContent, setComposerContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // AI State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDetectingIntent, setAiDetectingIntent] = useState(false);
  const [aiHandlingObjection, setAiHandlingObjection] = useState(false);
  const [generatedReply, setGeneratedReply] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<'professional' | 'friendly' | 'short' | 'follow_up'>('professional');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [objectionResponse, setObjectionResponse] = useState<{
    detectedObjection: string;
    suggestedResponse: string;
    alternativeResponses: string[];
    tips: string[];
  } | null>(null);

  // Intent Confirmation Modal State
  const [intentModalOpen, setIntentModalOpen] = useState(false);
  const [pendingIntentChange, setPendingIntentChange] = useState<{
    suggestedIntent: string;
    confidence: number;
    reasoning?: string;
  } | null>(null);

  // Batch Selection State
  const [selectedReplies, setSelectedReplies] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Current selected index for keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts handler
  const handleShortcutAction = useCallback((action: ShortcutAction) => {
    switch (action) {
      case 'navigate-down':
        setSelectedIndex((prev) => {
          const newIndex = Math.min(prev + 1, replies.length - 1);
          if (newIndex >= 0 && replies[newIndex]) {
            selectReply(replies[newIndex]);
          }
          return newIndex;
        });
        break;
      case 'navigate-up':
        setSelectedIndex((prev) => {
          const newIndex = Math.max(prev - 1, 0);
          if (newIndex >= 0 && replies[newIndex]) {
            selectReply(replies[newIndex]);
          }
          return newIndex;
        });
        break;
      case 'archive':
        if (selectedReply) {
          archiveReply(selectedReply.id);
        }
        break;
      case 'mark-read':
        if (selectedReply && !selectedReply.is_read) {
          markAsRead(selectedReply.id);
        }
        break;
      case 'reply':
        const usableInboxes = inboxes.filter((i) => i.status === 'active' || i.status === 'warming_up');
        if (selectedReply && !isComposerOpen && usableInboxes.length > 0) {
          openComposer();
        } else if (usableInboxes.length === 0) {
          toast.error('No active inboxes available to send from');
        }
        break;
      case 'search':
        searchInputRef.current?.focus();
        break;
      case 'close':
        if (isComposerOpen) {
          closeComposer();
        } else {
          setSelectedReply(null);
          setSelectedIndex(-1);
          setShowAIPanel(false);
        }
        break;
      case 'select-all':
        selectAllReplies();
        break;
    }
  }, [replies, selectedReply, isComposerOpen, inboxes, toast]);

  // Initialize keyboard shortcuts
  const { helpModalOpen, setHelpModalOpen } = useKeyboardShortcuts({
    onAction: handleShortcutAction,
    enabled: !isComposerOpen && viewMode === 'inbox', // Disable when composer is open or in sent view
  });

  // Initialize notifications
  const { permission: notificationPermission } = useNotifications({
    teamId: teamId || undefined,
    enabled: !!teamId,
  });

  useEffect(() => {
    if (teamLoading || !teamId) return;

    async function fetchData() {
      // Fetch inboxes
      await fetchInboxes(teamId!);
      await fetchReplies(teamId!, 'all');

      setLoading(false);
    }

    fetchData();
  }, [teamId, teamLoading]);

  // Fetch sent replies when switching to sent view
  useEffect(() => {
    if (viewMode === 'sent' && teamId) {
      fetchSentReplies(teamId);
    }
  }, [viewMode, teamId]);

  // Clear selections when switching views
  useEffect(() => {
    if (viewMode === 'inbox') {
      setSelectedSent(null);
    } else {
      setSelectedReply(null);
      setSentError(null);
    }
  }, [viewMode]);

  const fetchInboxes = async (tid: string) => {
    setInboxesLoading(true);
    try {
      const { data, error } = await supabase
        .from('inboxes')
        .select('id, email, provider, status, health_score, from_name, sender_first_name, sender_last_name, sender_company, sender_title, sender_phone, sender_website')
        .eq('team_id', tid)
        .order('email', { ascending: true });

      if (error) {
        console.error('Error fetching inboxes:', error);
      }

      // Map data and provide defaults for potentially null fields
      const mappedInboxes = (data ?? []).map((inbox: any) => ({
        id: inbox.id,
        email: inbox.email,
        provider: inbox.provider || 'smtp',
        status: inbox.status || 'active',
        health_score: inbox.health_score ?? 100,
        from_name: inbox.from_name,
        sender_first_name: inbox.sender_first_name,
        sender_last_name: inbox.sender_last_name,
        sender_company: inbox.sender_company,
        sender_title: inbox.sender_title,
        sender_phone: inbox.sender_phone,
        sender_website: inbox.sender_website,
      })) as Inbox[];

      setInboxes(mappedInboxes);
    } finally {
      setInboxesLoading(false);
    }
  };

  const fetchReplies = async (tid: string, filterType: string) => {
    let query = supabase
      .from('replies')
      .select(`
        *,
        leads(id, email, first_name, last_name, company, title, phone, custom_fields),
        inboxes(id, email, provider, from_name, sender_first_name, sender_last_name, sender_company, sender_title, sender_phone, sender_website),
        campaigns(id, name)
      `)
      .eq('team_id', tid)
      .order('received_at', { ascending: false })
      .limit(100);

    if (filterType === 'unread') {
      query = query.eq('is_read', false).eq('is_archived', false);
    } else if (filterType === 'interested') {
      query = query.in('intent', ['interested', 'meeting_request']).eq('is_archived', false);
    } else if (filterType === 'archived') {
      query = query.eq('is_archived', true);
    } else {
      query = query.eq('is_archived', false);
    }

    const { data } = await query;
    setReplies(data ?? []);

    // Count unread
    const { count } = await supabase
      .from('replies')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', tid)
      .eq('is_read', false)
      .eq('is_archived', false);

    setUnreadCount(count ?? 0);

    // Intent counts
    const { data: allReplies } = await supabase
      .from('replies')
      .select('intent')
      .eq('team_id', tid)
      .eq('is_archived', false) as { data: { intent: string | null }[] | null };

    const counts: Record<string, number> = {};
    for (const r of allReplies ?? []) {
      counts[r.intent ?? 'unclassified'] = (counts[r.intent ?? 'unclassified'] ?? 0) + 1;
    }
    setIntentCounts(counts);
  };

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    setSelectedReply(null);
    if (teamId) {
      fetchReplies(teamId, newFilter);
    }
  };

  const fetchSentReplies = async (tid: string) => {
    setSentLoading(true);
    setSentError(null);
    try {
      const { data, error } = await (supabase
        .from('sent_replies') as any)
        .select(`
          *,
          inboxes(id, email, provider, from_name, sender_first_name, sender_last_name, sender_company, sender_title, sender_phone, sender_website),
          leads(id, email, first_name, last_name, company, title, phone, custom_fields),
          campaigns(id, name),
          replies(id, from_email, from_name, subject)
        `)
        .eq('team_id', tid)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSentReplies(data ?? []);
    } catch (error) {
      console.error('[UniboxPage] Failed to fetch sent replies:', error);
      const errorMsg = 'Failed to load sent emails';
      setSentError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSentLoading(false);
    }
  };

  const markAsRead = async (replyId: string) => {
    await (supabase
      .from('replies') as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', replyId);

    setReplies(replies.map((r) => (r.id === replyId ? { ...r, is_read: true } : r)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const archiveReply = async (replyId: string) => {
    await (supabase.from('replies') as any).update({ is_archived: true }).eq('id', replyId);

    setReplies(replies.filter((r) => r.id !== replyId));
    if (selectedReply?.id === replyId) {
      setSelectedReply(null);
    }
  };

  const updateIntent = async (replyId: string, intent: string) => {
    await (supabase
      .from('replies') as any)
      .update({ intent, intent_manual_override: true })
      .eq('id', replyId);

    setReplies(replies.map((r) => (r.id === replyId ? { ...r, intent } : r)));
    if (selectedReply?.id === replyId) {
      setSelectedReply({ ...selectedReply, intent });
    }
  };

  const selectReply = (reply: Reply) => {
    setSelectedReply(reply);
    setShowAIPanel(false);
    setGeneratedReply('');
    setObjectionResponse(null);
    setIsComposerOpen(false);
    if (!reply.is_read) {
      markAsRead(reply.id);
    }
  };

  // Composer functions
  const openComposer = (content?: string) => {
    setComposerContent(content || '');
    setIsComposerOpen(true);
    setIsComposerExpanded(true);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    setIsComposerExpanded(true);
    setComposerContent('');
  };

  const handleSendReply = async (data: { content: string; inboxId: string; subject?: string }) => {
    if (!selectedReply || !teamId || !accessToken) return;

    setSendingReply(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiBase}/api/v1/replies/${selectedReply.id}/send?team_id=${teamId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        let errorMessage = 'Failed to send reply';
        try {
          const error = await res.json();
          errorMessage = error.message || errorMessage;
        } catch {
          // Response was not JSON (e.g. plain text error or empty body)
          const text = await res.text().catch(() => '');
          if (text) errorMessage = text;
        }
        throw new Error(errorMessage);
      }

      // Success - close composer and show success message
      closeComposer();
      toast.success('Reply sent successfully!');
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error(`Failed to send reply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSendingReply(false);
    }
  };

  // AI Functions
  const generateAIReply = async (tone?: 'professional' | 'friendly' | 'short' | 'follow_up', fromComposer = false): Promise<string> => {
    console.log('[UniboxPage] generateAIReply called', {
      hasSelectedReply: !!selectedReply,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length,
      tone,
      fromComposer
    });

    if (!selectedReply || !accessToken) {
      console.warn('[UniboxPage] Early return - missing:', {
        selectedReply: !!selectedReply,
        accessToken: !!accessToken
      });

      const errorMsg = !selectedReply
        ? 'Please select a reply first'
        : 'Authentication required. Please refresh the page.';

      toast.error(errorMsg, 5000);

      return '';
    }

    setAiGenerating(true);
    // Only show AI panel if NOT from composer
    if (!fromComposer) {
      setShowAIPanel(true);
    }
    setGeneratedReply('');

    try {
      const emailContent = selectedReply.body_text || selectedReply.body_html || selectedReply.body_preview || '';
      const threadContext = `Subject: ${selectedReply.subject || '(No subject)'}\nFrom: ${selectedReply.from_name || selectedReply.from_email}`;

      console.log('[UniboxPage] Calling aiClient.generateReply...');
      const result = await aiClient.generateReply(
        threadContext,
        emailContent,
        tone || selectedTone,
        undefined,
        accessToken,
      );

      console.log('[UniboxPage] AI reply received:', result.reply?.substring(0, 100));
      setGeneratedReply(result.reply);

      // Show success toast when populating composer
      if (fromComposer) {
        toast.success('AI reply generated successfully!');
      }

      return result.reply;
    } catch (error) {
      console.error('[UniboxPage] AI Reply generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`AI generation failed: ${errorMessage}`);
      setGeneratedReply('Failed to generate reply. Please try again.');
      return '';
    } finally {
      setAiGenerating(false);
    }
  };

  // Fixed: Intent detection now shows modal instead of auto-updating
  const detectAIIntent = async () => {
    if (!selectedReply || !accessToken) return;

    setAiDetectingIntent(true);

    try {
      const emailContent = selectedReply.body_text || selectedReply.body_html || selectedReply.body_preview || '';

      const result = await aiClient.detectIntent(
        emailContent,
        selectedReply.subject || '',
        accessToken,
      );

      // Show confirmation modal instead of auto-updating
      setPendingIntentChange({
        suggestedIntent: result.intent,
        confidence: result.confidence,
        reasoning: result.reasoning,
      });
      setIntentModalOpen(true);
    } catch (error) {
      console.error('AI Intent detection failed:', error);
      toast.error('Failed to detect intent. Please try again.');
    } finally {
      setAiDetectingIntent(false);
    }
  };

  const handleAcceptIntent = () => {
    if (pendingIntentChange && selectedReply) {
      updateIntent(selectedReply.id, pendingIntentChange.suggestedIntent);
    }
    setIntentModalOpen(false);
    setPendingIntentChange(null);
  };

  const handleKeepCurrentIntent = () => {
    setIntentModalOpen(false);
    setPendingIntentChange(null);
  };

  const handleAIObjection = async () => {
    if (!selectedReply || !accessToken) return;

    setAiHandlingObjection(true);
    setShowAIPanel(true);

    try {
      const emailContent = selectedReply.body_text || selectedReply.body_html || selectedReply.body_preview || '';

      const result = await aiClient.handleObjection(
        emailContent,
        undefined,
        accessToken,
      );

      setObjectionResponse(result);
      setGeneratedReply(result.suggestedResponse);
    } catch (error) {
      console.error('AI Objection handling failed:', error);
      toast.error('Failed to handle objection. Please try again.');
    } finally {
      setAiHandlingObjection(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Batch Selection Functions
  const toggleReplySelection = (replyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedReplies);
    if (newSelected.has(replyId)) {
      newSelected.delete(replyId);
    } else {
      newSelected.add(replyId);
    }
    setSelectedReplies(newSelected);
  };

  const selectAllReplies = () => {
    if (selectedReplies.size === replies.length) {
      setSelectedReplies(new Set());
    } else {
      setSelectedReplies(new Set(replies.map((r) => r.id)));
    }
  };

  const clearSelection = () => {
    setSelectedReplies(new Set());
  };

  // Batch Intent Detection
  const batchDetectIntent = async () => {
    if (selectedReplies.size === 0 || !accessToken) return;

    setBatchProcessing(true);
    setBatchProgress({ current: 0, total: selectedReplies.size });

    // Filter out manually overridden replies
    const selectedReplyList = replies
      .filter((r) => selectedReplies.has(r.id))
      .filter((r) => !(r as any).intent_manual_override);

    if (selectedReplyList.length === 0) {
      toast.error('All selected replies have manual classifications');
      setBatchProcessing(false);
      return;
    }

    const emails = selectedReplyList.map((r) => ({
      id: r.id,
      subject: r.subject || '',
      body: r.body_text || r.body_html || r.body_preview || '',
    }));

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiBase}/api/v1/ai/batch-detect-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ emails }),
      });

      if (res.ok) {
        const results = await res.json();

        let processed = 0;
        for (const result of results) {
          await (supabase.from('replies') as any)
            .update({ intent: result.intent, intent_confidence: result.confidence })
            .eq('id', result.id)
            .eq('intent_manual_override', false);

          processed++;
          setBatchProgress({ current: processed, total: selectedReplyList.length });
        }

        if (teamId) {
          await fetchReplies(teamId, filter);
        }

        const manualOverrideCount = selectedReplies.size - selectedReplyList.length;
        if (manualOverrideCount > 0) {
          toast.info(`Skipped ${manualOverrideCount} manually classified emails`);
        }
        toast.success(`Successfully classified ${processed} replies!`);
      } else {
        // Fallback: Process one by one
        let processed = 0;
        for (const email of emails) {
          try {
            const result = await aiClient.detectIntent(email.body, email.subject, accessToken);
            await (supabase.from('replies') as any)
              .update({ intent: result.intent, intent_confidence: result.confidence })
              .eq('id', email.id)
              .eq('intent_manual_override', false);
            processed++;
            setBatchProgress({ current: processed, total: selectedReplyList.length });
          } catch {
            // Skip failed ones
          }
        }

        if (teamId) {
          await fetchReplies(teamId, filter);
        }

        const manualOverrideCount = selectedReplies.size - selectedReplyList.length;
        if (manualOverrideCount > 0) {
          toast.info(`Skipped ${manualOverrideCount} manually classified emails`);
        }
        toast.success(`Classified ${processed} of ${selectedReplyList.length} replies.`);
      }
    } catch (error) {
      console.error('Batch intent detection failed:', error);
      toast.error('Batch processing failed. Please try again.');
    } finally {
      setBatchProcessing(false);
      setSelectedReplies(new Set());
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  // Batch Archive
  const batchArchive = async () => {
    if (selectedReplies.size === 0) return;
    if (!confirm(`Archive ${selectedReplies.size} selected replies?`)) return;

    for (const replyId of selectedReplies) {
      await (supabase.from('replies') as any).update({ is_archived: true }).eq('id', replyId);
    }

    setReplies(replies.filter((r) => !selectedReplies.has(r.id)));
    setSelectedReplies(new Set());
    if (selectedReply && selectedReplies.has(selectedReply.id)) {
      setSelectedReply(null);
    }
  };

  // Batch Mark as Read
  const batchMarkAsRead = async () => {
    if (selectedReplies.size === 0) return;

    for (const replyId of selectedReplies) {
      await (supabase.from('replies') as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', replyId);
    }

    setReplies(replies.map((r) => (selectedReplies.has(r.id) ? { ...r, is_read: true } : r)));
    setSelectedReplies(new Set());
    const unreadSelected = replies.filter((r) => selectedReplies.has(r.id) && !r.is_read).length;
    setUnreadCount((prev) => Math.max(0, prev - unreadSelected));
  };

  const getIntentColor = (intent: string | null) => {
    switch (intent) {
      case 'interested':
      case 'meeting_request':
        return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300';
      case 'question':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300';
      case 'not_interested':
        return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300';
      case 'out_of_office':
      case 'auto_reply':
        return 'bg-muted text-muted-foreground';
      case 'bounce':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // SentList component for Sent view
  function SentList({
    items,
    selected,
    onSelect
  }: {
    items: any[];
    selected: any | null;
    onSelect: (item: any) => void;
  }) {
    return (
      <div className="w-96 border-r border-border overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-sm text-muted-foreground">
            {items.length} sent {items.length === 1 ? 'email' : 'emails'}
          </h2>
        </div>

        <div className="divide-y divide-border">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={`w-full px-4 py-3 text-left hover:bg-accent transition-colors ${
                selected?.id === item.id ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  item.status === 'sent' ? 'bg-green-500' :
                  item.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />

                <div className="flex-1 min-w-0">
                  {/* Recipient */}
                  <p className="font-medium text-sm truncate">
                    To: {item.leads?.email || 'Unknown'}
                    {item.leads?.first_name && (
                      <span className="text-muted-foreground ml-1">
                        ({item.leads.first_name} {item.leads.last_name})
                      </span>
                    )}
                  </p>

                  {/* Subject */}
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {item.subject || '(No subject)'}
                  </p>

                  {/* Sent date */}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(item.sent_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {items.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No sent emails yet</p>
          </div>
        )}
      </div>
    );
  }

  // SentDetail component for Sent view
  function SentDetail({ item }: { item: any }) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">
                {item.subject || '(No subject)'}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>From: {item.inboxes?.from_name || item.inboxes?.email}</span>
                <span>•</span>
                <span>To: {item.leads?.email}</span>
              </div>
            </div>

            {/* Status badge */}
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              item.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              item.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
              {item.status}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Sent on {new Date(item.sent_at).toLocaleString('en-US', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </p>
        </div>

        {/* Body */}
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: item.body_html }}
        />

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {item.leads && (
              <div>
                <p className="text-muted-foreground mb-1">Lead</p>
                <p className="font-medium">
                  {item.leads.first_name} {item.leads.last_name}
                </p>
                {item.leads.company && (
                  <p className="text-muted-foreground text-xs">{item.leads.company}</p>
                )}
              </div>
            )}

            {item.campaigns && (
              <div>
                <p className="text-muted-foreground mb-1">Campaign</p>
                <p className="font-medium">{item.campaigns.name}</p>
              </div>
            )}

            <div>
              <p className="text-muted-foreground mb-1">Sent from</p>
              <p className="font-medium">{item.inboxes?.email}</p>
            </div>

            {item.message_id && (
              <div>
                <p className="text-muted-foreground mb-1">Message ID</p>
                <p className="font-mono text-xs truncate">{item.message_id}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading || teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-120px)] flex flex-col ${isComposerOpen && isComposerExpanded ? 'pb-[380px]' : isComposerOpen ? 'pb-16' : ''}`}>
      {/* Keyboard Shortcuts Help Modal */}
      <ShortcutHelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />

      {/* Intent Confirmation Modal */}
      <IntentConfirmModal
        isOpen={intentModalOpen}
        onClose={() => setIntentModalOpen(false)}
        currentIntent={selectedReply?.intent ?? null}
        suggestedIntent={pendingIntentChange?.suggestedIntent ?? ''}
        confidence={pendingIntentChange?.confidence ?? 0}
        reasoning={pendingIntentChange?.reasoning}
        onAccept={handleAcceptIntent}
        onKeepCurrent={handleKeepCurrentIntent}
      />

      {/* Notification Permission Banner */}
      {notificationPermission === 'default' && (
        <NotificationPermission />
      )}

      {/* Header */}
      <div className="flex-shrink-0 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Unibox</h1>
          <ViewSelector value={viewMode} onChange={setViewMode} />
          {viewMode === 'sent' && (
            <button
              onClick={() => teamId && fetchSentReplies(teamId)}
              disabled={sentLoading}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              title="Refresh sent emails"
            >
              <RefreshCw className={`w-4 h-4 ${sentLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        <button
          onClick={() => setHelpModalOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-5 h-5" />
        </button>
      </div>

      {viewMode === 'inbox' ? (
        <>
          {/* Filters */}
          <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('unread')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1 ${
              filter === 'unread' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleFilterChange('interested')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === 'interested' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Interested
          </button>
          <button
            onClick={() => handleFilterChange('archived')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === 'archived' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Archived
          </button>
        </div>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search replies... (press /)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Reply List */}
        <div className="w-96 flex-shrink-0 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
          {/* Bulk Actions Bar */}
          {selectedReplies.size > 0 && (
            <div className="flex-shrink-0 p-3 bg-primary/5 border-b border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={clearSelection}
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-foreground">
                  {selectedReplies.size} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={batchDetectIntent}
                  disabled={batchProcessing}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                  title="Re-classify all selected with AI"
                >
                  {batchProcessing ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {batchProgress.current}/{batchProgress.total}
                    </>
                  ) : (
                    <>
                      <Brain className="w-3 h-3" />
                      Re-classify
                    </>
                  )}
                </button>
                <button
                  onClick={batchMarkAsRead}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-foreground rounded hover:bg-muted/80"
                  title="Mark as read"
                >
                  <CheckCircle className="w-3 h-3" />
                  Read
                </button>
                <button
                  onClick={batchArchive}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-foreground rounded hover:bg-muted/80"
                  title="Archive"
                >
                  <Archive className="w-3 h-3" />
                  Archive
                </button>
              </div>
            </div>
          )}

          {/* Select All Header */}
          {replies.length > 0 && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-border flex items-center gap-2">
              <button
                onClick={selectAllReplies}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
                title={selectedReplies.size === replies.length ? 'Deselect all' : 'Select all'}
              >
                {selectedReplies.size === replies.length && replies.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedReplies.size > 0
                  ? `${selectedReplies.size} of ${replies.length} selected`
                  : `${replies.length} replies`
                }
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {replies.map((reply) => (
              <div
                key={reply.id}
                className={`flex items-start gap-2 p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                  selectedReply?.id === reply.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                } ${!reply.is_read ? 'bg-blue-50/50 dark:bg-blue-500/10' : ''}`}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => toggleReplySelection(reply.id, e)}
                  className="mt-1 p-1 text-muted-foreground hover:text-foreground rounded flex-shrink-0"
                >
                  {selectedReplies.has(reply.id) ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>

                {/* Reply Content */}
                <button
                  onClick={() => selectReply(reply)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-muted-foreground">
                        {reply.from_name?.charAt(0) || reply.from_email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium text-foreground truncate ${!reply.is_read ? 'font-semibold' : ''}`}>
                        {reply.from_name || reply.from_email}
                      </span>
                      {!reply.is_read && (
                        <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{reply.subject || '(No subject)'}</p>
                    <p className="text-xs text-muted-foreground/70 truncate mt-1">
                      {reply.body_preview?.substring(0, 60)}...
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {reply.intent && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getIntentColor(reply.intent)}`}>
                          {reply.intent.replace('_', ' ')}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground/70">
                        {new Date(reply.received_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  </div>
                </button>
              </div>
            ))}

            {replies.length === 0 && (
              <div className="p-8 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No replies found</p>
              </div>
            )}
          </div>
        </div>

        {/* Reply Detail */}
        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
          {selectedReply ? (
            <>
              <div className="flex-shrink-0 p-4 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {selectedReply.subject || '(No subject)'}
                    </h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {selectedReply.from_name || selectedReply.from_email}
                      </span>
                      {selectedReply.leads?.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {selectedReply.leads.company}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(selectedReply.received_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Reply Button */}
                    {(() => {
                      const usableInboxes = inboxes.filter((i) => i.status === 'active' || i.status === 'warming_up');
                      const hasUsableInboxes = usableInboxes.length > 0;
                      return (
                        <button
                          onClick={() => openComposer()}
                          disabled={!hasUsableInboxes || inboxesLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title={hasUsableInboxes ? 'Reply (R)' : 'No active inboxes available'}
                        >
                          <Send className="w-4 h-4" />
                          Reply
                        </button>
                      );
                    })()}
                    <button
                      onClick={() => archiveReply(selectedReply.id)}
                      className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                      title="Archive"
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Intent Classification */}
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-sm text-muted-foreground">Classification:</span>
                  <div className="flex gap-1">
                    {['interested', 'question', 'not_interested', 'neutral'].map((intent) => (
                      <button
                        key={intent}
                        onClick={() => updateIntent(selectedReply.id, intent)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          selectedReply.intent === intent
                            ? getIntentColor(intent)
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {intent.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={detectAIIntent}
                    disabled={aiDetectingIntent}
                    className="ml-2 p-1 text-primary hover:bg-primary/10 rounded"
                    title="Auto-detect intent with AI (shows confirmation)"
                  >
                    {aiDetectingIntent ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Brain className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* AI Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border flex-wrap">
                  {/* Quick Templates */}
                  {teamId && (
                    <TemplateSelector
                      teamId={teamId}
                      intentType={selectedReply.intent || undefined}
                      lead={selectedReply.leads ? {
                        first_name: selectedReply.leads.first_name || undefined,
                        last_name: selectedReply.leads.last_name || undefined,
                        company: selectedReply.leads.company || undefined,
                        email: selectedReply.leads.email,
                      } : undefined}
                      originalSubject={selectedReply.subject || undefined}
                      onSelect={(content) => {
                        setGeneratedReply(content);
                        setShowAIPanel(true);
                      }}
                    />
                  )}

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTone}
                      onChange={(e) => setSelectedTone(e.target.value as typeof selectedTone)}
                      className="text-sm border border-border rounded-lg px-2 py-1 bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="short">Short</option>
                      <option value="follow_up">Follow-up</option>
                    </select>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        console.log('[MAIN VIEW] Generate AI Reply button CLICKED!', { aiGenerating });
                        generateAIReply();
                      }}
                      disabled={aiGenerating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {aiGenerating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Generate AI Reply
                    </button>
                  </div>
                  <button
                    onClick={handleAIObjection}
                    disabled={aiHandlingObjection}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300 text-sm rounded-lg hover:bg-orange-200 dark:hover:bg-orange-500/30 disabled:opacity-50"
                  >
                    {aiHandlingObjection ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    Handle Objection
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{
                    __html: selectedReply.body_html || selectedReply.body_text || selectedReply.body_preview || '',
                  }}
                />

                {/* AI Response Panel */}
                {showAIPanel && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10 rounded-xl border border-primary/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <span className="font-medium text-foreground">AI Generated Reply</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateAIReply()}
                          disabled={aiGenerating}
                          className="p-1.5 text-muted-foreground hover:text-primary rounded"
                          title="Regenerate"
                        >
                          <RefreshCw className={`w-4 h-4 ${aiGenerating ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => copyToClipboard(generatedReply)}
                          className="p-1.5 text-muted-foreground hover:text-primary rounded"
                          title="Copy to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openComposer(generatedReply)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-primary rounded hover:bg-primary/90"
                          title="Use this reply"
                        >
                          <Send className="w-3 h-3" />
                          Use
                        </button>
                        <button
                          onClick={() => setShowAIPanel(false)}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                        >
                          &times;
                        </button>
                      </div>
                    </div>

                    {aiGenerating || aiHandlingObjection ? (
                      <div className="flex items-center gap-2 py-4 text-muted-foreground">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generating response...</span>
                      </div>
                    ) : (
                      <>
                        <div className="bg-card rounded-lg p-4 border border-border">
                          <textarea
                            value={generatedReply}
                            onChange={(e) => setGeneratedReply(e.target.value)}
                            rows={6}
                            className="w-full text-sm text-foreground bg-transparent resize-none border-0 focus:ring-0 p-0"
                            placeholder="AI-generated reply will appear here..."
                          />
                        </div>

                        {/* Objection Response Details */}
                        {objectionResponse && (
                          <div className="mt-4 space-y-3">
                            <div className="bg-orange-50 dark:bg-orange-500/10 rounded-lg p-3">
                              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                                Detected Objection: {objectionResponse.detectedObjection}
                              </p>
                            </div>

                            {objectionResponse.alternativeResponses.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-foreground mb-2">Alternative Responses:</p>
                                <div className="space-y-2">
                                  {objectionResponse.alternativeResponses.map((alt, i) => (
                                    <button
                                      key={i}
                                      onClick={() => setGeneratedReply(alt)}
                                      className="w-full text-left p-2 text-sm bg-card rounded border border-border hover:border-primary/50 hover:bg-primary/5"
                                    >
                                      {alt.substring(0, 100)}...
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {objectionResponse.tips.length > 0 && (
                              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3">
                                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Tips:</p>
                                <ul className="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
                                  {objectionResponse.tips.map((tip, i) => (
                                    <li key={i}>{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Lead Info */}
              {selectedReply.leads && (
                <div className="flex-shrink-0 p-4 bg-muted/50 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {selectedReply.leads.first_name} {selectedReply.leads.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedReply.leads.email}</p>
                    </div>
                    {selectedReply.campaigns && (
                      <span className="text-sm text-muted-foreground">
                        Campaign: {selectedReply.campaigns.name}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Select a reply to view</p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Use <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">j</kbd>/<kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">k</kbd> to navigate
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

          {/* Reply Composer */}
          {isComposerOpen && selectedReply && (
            <ReplyComposer
              reply={selectedReply}
              teamId={teamId || ''}
              inboxes={inboxes}
              defaultContent={composerContent}
              onSend={handleSendReply}
              onCancel={closeComposer}
              onGenerateAI={(tone) => generateAIReply(tone, true)}
              isGeneratingAI={aiGenerating}
              onExpandedChange={setIsComposerExpanded}
            />
          )}
        </>
      ) : (
        // Sent view
        <div className="flex-1 flex border border-border rounded-lg overflow-hidden bg-background">
          {sentLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Loading sent emails...</p>
              </div>
            </div>
          ) : sentError ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">{sentError}</p>
                <button
                  onClick={() => teamId && fetchSentReplies(teamId)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              <SentList
                items={sentReplies}
                selected={selectedSent}
                onSelect={setSelectedSent}
              />

              {selectedSent ? (
                <SentDetail item={selectedSent} />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Mail className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">Select a sent email to view</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
