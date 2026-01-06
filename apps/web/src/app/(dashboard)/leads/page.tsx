'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Plus, Upload, Search, Users, Filter, MoreHorizontal, Trash2, FolderOpen } from 'lucide-react';

interface Lead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  status: string;
  created_at: string;
  lead_lists?: { name: string };
}

interface LeadList {
  id: string;
  name: string;
  lead_count: number;
  created_at: string;
}

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedList, setSelectedList] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

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

      // Fetch lead lists
      const { data: lists } = await supabase
        .from('lead_lists')
        .select('*')
        .eq('team_id', tid)
        .order('created_at', { ascending: false });

      setLeadLists(lists ?? []);

      // Check for list filter in URL
      const listFromUrl = searchParams.get('list') || '';
      setSelectedList(listFromUrl);

      // Fetch leads with filter if provided
      await fetchLeads(tid, listFromUrl, '');

      setLoading(false);
    }

    fetchData();
  }, [supabase, router, searchParams]);

  const fetchLeads = async (tid: string, listId: string, search: string) => {
    let query = supabase
      .from('leads')
      .select('*, lead_lists(name)', { count: 'exact' })
      .eq('team_id', tid)
      .order('created_at', { ascending: false })
      .limit(50);

    if (listId) {
      query = query.eq('lead_list_id', listId);
    }

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`,
      );
    }

    const { data, count } = await query;
    setLeads(data ?? []);
    setTotalCount(count ?? 0);
  };

  const handleSearch = () => {
    if (teamId) {
      fetchLeads(teamId, selectedList, searchQuery);
    }
  };

  const handleListChange = (listId: string) => {
    setSelectedList(listId);
    if (teamId) {
      fetchLeads(teamId, listId, searchQuery);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeads.length === 0 || !teamId) return;

    if (!confirm(`Delete ${selectedLeads.length} leads?`)) return;

    const { error } = await supabase
      .from('leads')
      .delete()
      .in('id', selectedLeads);

    if (!error) {
      setSelectedLeads([]);
      fetchLeads(teamId, selectedList, searchQuery);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-300';
      case 'contacted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300';
      case 'replied':
        return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300';
      case 'interested':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300';
      case 'not_interested':
        return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300';
      case 'bounced':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-300';
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground">Manage your lead lists and contacts</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/leads/lists"
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-accent"
          >
            <FolderOpen className="w-4 h-4" />
            Manage Lists
          </Link>
          <Link
            href="/leads/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-accent"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </Link>
        </div>
      </div>

      {/* Lead Lists Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => handleListChange('')}
          className={`bg-card rounded-xl border p-4 text-left hover:border-primary transition-colors ${
            selectedList === '' ? 'border-primary' : 'border-border'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
              <p className="text-sm text-muted-foreground">All Leads</p>
            </div>
          </div>
        </button>
        {leadLists.slice(0, 3).map((list) => (
          <button
            key={list.id}
            onClick={() => handleListChange(list.id)}
            className={`bg-card rounded-xl border p-4 text-left hover:border-primary transition-colors ${
              selectedList === list.id ? 'border-primary' : 'border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{list.lead_count}</p>
                <p className="text-sm text-muted-foreground truncate">{list.name}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={selectedList}
          onChange={(e) => handleListChange(e.target.value)}
          className="px-4 py-2 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground"
        >
          <option value="">All Lists</option>
          {leadLists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-accent"
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedLeads.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
          <span className="text-sm text-blue-800 dark:text-blue-300">
            {selectedLeads.length} lead(s) selected
          </span>
          <button
            onClick={handleDeleteSelected}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={() => setSelectedLeads([])}
            className="ml-auto text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedLeads.length === leads.length && leads.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLeads(leads.map((l) => l.id));
                    } else {
                      setSelectedLeads([]);
                    }
                  }}
                  className="w-4 h-4 text-primary rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                List
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Added
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-muted/30">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedLeads.includes(lead.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLeads([...selectedLeads, lead.id]);
                      } else {
                        setSelectedLeads(selectedLeads.filter((id) => id !== lead.id));
                      }
                    }}
                    className="w-4 h-4 text-primary rounded"
                  />
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {lead.first_name || lead.last_name
                        ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                        : '-'}
                    </p>
                    <p className="text-sm text-muted-foreground">{lead.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="text-foreground">{lead.company || '-'}</p>
                    {lead.title && <p className="text-sm text-muted-foreground">{lead.title}</p>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {lead.lead_lists?.name || '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent inline-block"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {leads.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No leads found</p>
            <Link
              href="/leads/import"
              className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80"
            >
              <Upload className="w-4 h-4" />
              Import your first leads
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
