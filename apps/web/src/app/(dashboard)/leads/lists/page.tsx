'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Plus, Users, MoreHorizontal, Trash2, Edit2, ArrowLeft } from 'lucide-react';

interface LeadList {
  id: string;
  name: string;
  description: string | null;
  lead_count: number;
  source: string | null;
  created_at: string;
}

export default function LeadListsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

      await fetchLeadLists(tid);
      setLoading(false);
    }

    fetchData();
  }, [supabase, router]);

  const fetchLeadLists = async (tid: string) => {
    const { data } = await supabase
      .from('lead_lists')
      .select('*')
      .eq('team_id', tid)
      .order('created_at', { ascending: false });

    setLeadLists(data ?? []);
  };

  const handleDelete = async (listId: string) => {
    if (!teamId) return;

    setDeleting(true);

    try {
      // Delete all leads in the list first
      await supabase
        .from('leads')
        .delete()
        .eq('lead_list_id', listId);

      // Delete the list
      const { error } = await supabase
        .from('lead_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      setDeleteConfirm(null);
      await fetchLeadLists(teamId);
    } catch (err) {
      console.error('Failed to delete list:', err);
      alert('Failed to delete list. Please try again.');
    } finally {
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

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leads
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead Lists</h1>
          <p className="text-muted-foreground">Organize your leads into lists for campaigns</p>
        </div>
        <Link
          href="/leads/lists/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Create List
        </Link>
      </div>

      {/* Lists Grid */}
      {leadLists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leadLists.map((list) => (
            <div
              key={list.id}
              className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{list.name}</h3>
                    <p className="text-sm text-muted-foreground">{list.lead_count} leads</p>
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setDeleteConfirm(deleteConfirm === list.id ? null : list.id)}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {deleteConfirm === list.id && (
                    <div className="absolute right-0 top-10 w-48 bg-card rounded-lg border border-border shadow-lg z-10">
                      <Link
                        href={`/leads/lists/${list.id}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit List
                      </Link>
                      <button
                        onClick={() => handleDelete(list.id)}
                        disabled={deleting}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deleting ? 'Deleting...' : 'Delete List'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {list.description && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{list.description}</p>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Created {new Date(list.created_at).toLocaleDateString()}
                </span>
                <Link
                  href={`/leads?list=${list.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  View Leads
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No lead lists yet</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Create a list to organize your leads for campaigns
          </p>
          <Link
            href="/leads/lists/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Create Your First List
          </Link>
        </div>
      )}
    </div>
  );
}
