'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, FolderPlus } from 'lucide-react';

export default function NewLeadListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

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

      if (teamMembers && teamMembers.length > 0) {
        setTeamId(teamMembers[0].team_id);
      }

      setLoading(false);
    }

    fetchData();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !name.trim()) return;

    setError(null);
    setSaving(true);

    try {
      const { data: newList, error: insertError } = await (supabase
        .from('lead_lists') as any)
        .insert({
          team_id: teamId,
          name: name.trim(),
          description: description.trim() || null,
          source: 'manual',
          lead_count: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      router.push('/leads/lists');
    } catch (err) {
      console.error('Failed to create list:', err);
      setError('Failed to create list. Please try again.');
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
    <div className="max-w-xl mx-auto">
      <Link
        href="/leads/lists"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Lead Lists
      </Link>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">Create Lead List</h1>
          <p className="text-muted-foreground mt-1">Create a new list to organize your leads</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              List Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2024 Prospects"
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
              placeholder="Optional description for this list..."
              rows={3}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
            <Link href="/leads/lists" className="px-4 py-2 text-muted-foreground hover:text-foreground">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  Create List
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
