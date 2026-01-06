'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Save, Trash2, Users } from 'lucide-react';

interface LeadList {
  id: string;
  name: string;
  description: string | null;
  lead_count: number;
  source: string | null;
  created_at: string;
}

export default function EditLeadListPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [list, setList] = useState<LeadList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

      if (!teamMembers || teamMembers.length === 0) {
        setLoading(false);
        return;
      }

      const tid = teamMembers[0].team_id;
      setTeamId(tid);

      // Fetch the lead list
      const { data: listData, error: listError } = await supabase
        .from('lead_lists')
        .select('*')
        .eq('id', listId)
        .eq('team_id', tid)
        .single();

      if (listError || !listData) {
        router.push('/leads/lists');
        return;
      }

      const list = listData as LeadList;
      setList(list);
      setName(list.name || '');
      setDescription(list.description || '');

      setLoading(false);
    }

    fetchData();
  }, [supabase, router, listId]);

  const handleSave = async () => {
    if (!teamId || !name.trim()) return;

    setError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const { error: updateError } = await (supabase
        .from('lead_lists') as any)
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq('id', listId);

      if (updateError) throw updateError;

      // Refresh list data
      const { data: updatedList } = await supabase
        .from('lead_lists')
        .select('*')
        .eq('id', listId)
        .single();

      if (updatedList) {
        setList(updatedList as unknown as LeadList);
      }
      setSuccessMessage('List updated successfully');
    } catch (err) {
      console.error('Failed to update list:', err);
      setError('Failed to update list. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!teamId) return;
    if (!confirm(`Are you sure you want to delete "${list?.name}"? This will also delete all ${list?.lead_count} leads in this list.`)) return;

    setDeleting(true);

    try {
      // Delete all leads in the list first
      await supabase
        .from('leads')
        .delete()
        .eq('lead_list_id', listId);

      // Delete the list
      const { error: deleteError } = await supabase
        .from('lead_lists')
        .delete()
        .eq('id', listId);

      if (deleteError) throw deleteError;

      router.push('/leads/lists');
    } catch (err) {
      console.error('Failed to delete list:', err);
      setError('Failed to delete list. Please try again.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">List not found</p>
        <Link href="/leads/lists" className="text-primary hover:underline mt-2 inline-block">
          Back to Lead Lists
        </Link>
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
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Edit Lead List</h1>
              <p className="text-muted-foreground">{list.lead_count} leads in this list</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
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

          <div className="text-sm text-muted-foreground space-y-1">
            <p>Source: {list.source || 'Unknown'}</p>
            <p>Created: {new Date(list.created_at).toLocaleDateString()}</p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete List'}
            </button>
            <div className="flex items-center gap-4">
              <Link
                href={`/leads?list=${listId}`}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                View Leads
              </Link>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
