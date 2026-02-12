'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { aiClient, AIDailySummaryResponse } from '@/lib/ai/client';
import { Sparkles, RefreshCw, TrendingUp, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function AIDailySummary() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [summary, setSummary] = useState<AIDailySummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
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

      if (teamMembers && teamMembers.length > 0) {
        setTeamId(teamMembers[0].team_id);
      }

      setLoading(false);
    }

    init();
  }, [supabase]);

  const generateSummary = async () => {
    if (!teamId || !accessToken) return;

    setGenerating(true);
    setError(null);

    try {
      const result = await aiClient.getDailySummary(teamId, accessToken);
      setSummary(result);
    } catch (err) {
      console.error('Failed to generate summary:', err);
      setError('Failed to generate summary. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10 rounded-xl border border-primary/20 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-48 mb-4"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10 rounded-xl border border-primary/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">AI Daily Summary</h3>
              <p className="text-sm text-muted-foreground">Get AI-powered insights on your inbox activity</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={generateSummary}
          disabled={generating || !teamId}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 disabled:opacity-50"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating Summary...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Today's Summary
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10 rounded-xl border border-primary/20 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-primary to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI Daily Summary</h3>
            <p className="text-sm text-muted-foreground">Today's overview</p>
          </div>
        </div>
        <button
          onClick={generateSummary}
          disabled={generating}
          className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-card"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-card/60 dark:bg-card rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{summary.metrics.totalReplies}</p>
          <p className="text-xs text-muted-foreground">Replies</p>
        </div>
        <div className="bg-card/60 dark:bg-card rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.metrics.interested}</p>
          <p className="text-xs text-muted-foreground">Interested</p>
        </div>
        <div className="bg-card/60 dark:bg-card rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.metrics.notInterested}</p>
          <p className="text-xs text-muted-foreground">Not Interested</p>
        </div>
        <div className="bg-card/60 dark:bg-card rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{summary.metrics.needsAttention}</p>
          <p className="text-xs text-muted-foreground">Needs Attention</p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card/60 dark:bg-card rounded-lg p-4 mb-4">
        <p className="text-foreground/80">{summary.summary}</p>
      </div>

      {/* Highlights */}
      {summary.highlights.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground/80 mb-2">Highlights</p>
          <ul className="space-y-1">
            {summary.highlights.map((highlight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items */}
      {summary.actionItems.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground/80 mb-2">Recommended Actions</p>
          <ul className="space-y-2">
            {summary.actionItems.map((action, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Link to replies */}
      {summary.metrics.needsAttention > 0 && (
        <a
          href="/unibox?filter=unread"
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
        >
          View unread replies
          <ArrowRight className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
