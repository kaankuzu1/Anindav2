'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { aiClient } from '@/lib/ai/client';
import {
  MessageSquare,
  Search,
  Filter,
  Mail,
  CheckCircle,
  Archive,
  Star,
  User,
  Building2,
  Clock,
  Sparkles,
  Wand2,
  AlertTriangle,
  Copy,
  Send,
  RefreshCw,
  Brain,
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
  is_read: boolean;
  is_archived: boolean;
  received_at: string;
  leads: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
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

export default function RepliesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [selectedReply, setSelectedReply] = useState<Reply | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'interested' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [accessToken, setAccessToken] = useState<string>('');

  // Stats
  const [unreadCount, setUnreadCount] = useState(0);
  const [intentCounts, setIntentCounts] = useState<Record<string, number>>({});

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

  useEffect(() => {
    async function fetchData() {
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

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1) as { data: { team_id: string }[] | null };

      if (!teamMembers || teamMembers.length === 0) {
        setLoading(false);
        return;
      }

      const tid = teamMembers[0].team_id;
      setTeamId(tid);

      await fetchReplies(tid, 'all');

      setLoading(false);
    }

    fetchData();
  }, [supabase, router]);

  const fetchReplies = async (tid: string, filterType: string) => {
    let query = supabase
      .from('replies')
      .select(`
        *,
        leads(id, email, first_name, last_name, company),
        inboxes(id, email, provider),
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
    if (!reply.is_read) {
      markAsRead(reply.id);
    }
  };

  // AI Functions
  const generateAIReply = async () => {
    if (!selectedReply || !accessToken) return;

    setAiGenerating(true);
    setShowAIPanel(true);
    setGeneratedReply('');

    try {
      const emailContent = selectedReply.body_text || selectedReply.body_html || selectedReply.body_preview || '';
      const threadContext = `Subject: ${selectedReply.subject || '(No subject)'}\nFrom: ${selectedReply.from_name || selectedReply.from_email}`;

      const result = await aiClient.generateReply(
        threadContext,
        emailContent,
        selectedTone,
        undefined,
        accessToken,
      );

      setGeneratedReply(result.reply);
    } catch (error) {
      console.error('AI Reply generation failed:', error);
      setGeneratedReply('Failed to generate reply. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

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

      // Update the intent in the database
      await updateIntent(selectedReply.id, result.intent);

      // Show confidence
      alert(`Detected intent: ${result.intent} (${Math.round(result.confidence * 100)}% confidence)\n\nReasoning: ${result.reasoning}`);
    } catch (error) {
      console.error('AI Intent detection failed:', error);
      alert('Failed to detect intent. Please try again.');
    } finally {
      setAiDetectingIntent(false);
    }
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
      alert('Failed to handle objection. Please try again.');
    } finally {
      setAiHandlingObjection(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-foreground">Unified Inbox</h1>
        <p className="text-muted-foreground">Manage all your email replies in one place</p>
      </div>

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
            type="text"
            placeholder="Search replies..."
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
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {replies.map((reply) => (
              <button
                key={reply.id}
                onClick={() => selectReply(reply)}
                className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                  selectedReply?.id === reply.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                } ${!reply.is_read ? 'bg-blue-50/50 dark:bg-blue-500/10' : ''}`}
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
                    title="Auto-detect intent with AI"
                  >
                    {aiDetectingIntent ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Brain className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* AI Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
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
                      onClick={generateAIReply}
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
                  className="prose prose-sm max-w-none"
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
                          onClick={generateAIReply}
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
