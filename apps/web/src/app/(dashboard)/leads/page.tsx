'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { Plus, Upload, Search, Users, Filter, MoreHorizontal, Trash2, FolderOpen, CheckCircle, XCircle, AlertTriangle, HelpCircle, Save, X, ShieldCheck, RefreshCw } from 'lucide-react';
import { getLeadStatusColor, getVerificationStatusColor, getVerificationIcon, formatLeadStatus } from '@/lib/lead-status';
import { StatCard } from '@/components/ui/stat-card';

type EditableField = 'first_name' | 'last_name' | 'email' | 'company' | 'title';

interface EditingCell {
  leadId: string;
  field: EditableField;
}

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
  email_verification_status: string | null;
  email_risk_score: number | null;
}

interface LeadList {
  id: string;
  name: string;
  lead_count: number;
  created_at: string;
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { teamId, loading: teamLoading, accessToken } = useTeam();

  const [loading, setLoading] = useState(true);
  const [verifyingLead, setVerifyingLead] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedList, setSelectedList] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editedLeads, setEditedLeads] = useState<Map<string, Partial<Lead>>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (teamLoading) return;
    if (!teamId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      // Fetch lead lists
      const { data: lists, error: listsError } = await supabase
        .from('lead_lists')
        .select('*')
        .eq('team_id', teamId!)
        .order('created_at', { ascending: false });

      if (listsError) {
        console.error('Failed to fetch lead_lists:', listsError);
      }

      setLeadLists(lists ?? []);

      // Check for list filter in URL
      const listFromUrl = searchParams.get('list') || '';
      setSelectedList(listFromUrl);

      // Fetch leads with filter if provided
      await fetchLeads(teamId!, listFromUrl, '');

      setLoading(false);
    }

    fetchData();
  }, [teamId, teamLoading]);

  const fetchLeads = async (tid: string, listId: string, search: string) => {
    let query = supabase
      .from('leads')
      .select('*, lead_lists(name), email_verification_status, email_risk_score', { count: 'exact' })
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

    const { data, count, error: leadsError } = await query;
    if (leadsError) {
      console.error('Failed to fetch leads:', leadsError);
    }
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

  // Inline editing helpers
  const getDisplayValue = useCallback((lead: Lead, field: EditableField): string => {
    const edits = editedLeads.get(lead.id);
    if (edits && field in edits) {
      return (edits[field] as string) ?? '';
    }
    return (lead[field] as string) ?? '';
  }, [editedLeads]);

  const isFieldEdited = useCallback((leadId: string, field: EditableField): boolean => {
    const edits = editedLeads.get(leadId);
    return edits !== undefined && field in edits;
  }, [editedLeads]);

  const handleCellClick = useCallback((leadId: string, field: EditableField) => {
    setEditingCell({ leadId, field });
    setSaveError(null);
    setSaveSuccess(null);
  }, []);

  const handleCellChange = useCallback((leadId: string, field: EditableField, value: string) => {
    setEditedLeads(prev => {
      const next = new Map(prev);
      const existing = next.get(leadId) || {};
      next.set(leadId, { ...existing, [field]: value });
      return next;
    });
  }, []);

  const handleCellBlur = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, leadId: string, field: EditableField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Revert this specific field edit
      setEditedLeads(prev => {
        const next = new Map(prev);
        const existing = next.get(leadId);
        if (existing) {
          const updated = { ...existing };
          delete updated[field];
          if (Object.keys(updated).length === 0) {
            next.delete(leadId);
          } else {
            next.set(leadId, updated);
          }
        }
        return next;
      });
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setEditingCell(null);
      // Move to next editable field in the same row
      const fieldOrder: EditableField[] = ['first_name', 'last_name', 'email', 'company', 'title'];
      const currentIndex = fieldOrder.indexOf(field);
      const nextField = e.shiftKey
        ? fieldOrder[currentIndex - 1]
        : fieldOrder[currentIndex + 1];
      if (nextField) {
        // Use setTimeout to allow the blur to complete first
        setTimeout(() => setEditingCell({ leadId, field: nextField }), 0);
      }
    }
  }, []);

  const handleSaveAll = async () => {
    if (editedLeads.size === 0 || !teamId) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const [leadId, changes] of editedLeads.entries()) {
        // Validate email if it was changed
        if (changes.email !== undefined) {
          if (!emailRegex.test(changes.email)) {
            throw new Error(`Invalid email address for one or more leads`);
          }
        }

        const updateData: Record<string, string | null> = {};
        for (const [key, value] of Object.entries(changes)) {
          if (key === 'email') {
            updateData[key] = (value as string).toLowerCase();
          } else {
            updateData[key] = (value as string) || null;
          }
        }

        const { error } = await (supabase.from('leads') as any)
          .update(updateData)
          .eq('id', leadId);

        if (error) throw error;
      }

      setSaveSuccess(`${editedLeads.size} lead(s) updated`);
      setEditedLeads(new Map());
      setEditingCell(null);

      // Refresh leads
      fetchLeads(teamId, selectedList, searchQuery);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save leads:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardAll = useCallback(() => {
    setEditedLeads(new Map());
    setEditingCell(null);
    setSaveError(null);
    setSaveSuccess(null);
  }, []);

  const handleVerifyEmail = async (leadId: string) => {
    if (!teamId || !accessToken) return;
    setVerifyingLead(leadId);
    try {
      const res = await fetch(`${apiUrl}/leads/${leadId}/verify?team_id=${teamId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (res.ok) {
        let result: { status?: string } = {};
        try {
          result = await res.json();
        } catch {
          // Non-JSON response
        }
        setLeads(prev => prev.map(l =>
          l.id === leadId
            ? { ...l, email_verification_status: result.status || 'valid' }
            : l
        ));
      } else {
        console.error('Email verification failed:', await res.text().catch(() => 'Unknown error'));
      }
    } catch (err) {
      console.error('Email verification error:', err);
    } finally {
      setVerifyingLead(null);
    }
  };

  // Focus the input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Helper to render verification icon
  const VerificationIcon = ({ status }: { status: string | null }) => {
    const icon = getVerificationIcon(status);
    const colorClass = getVerificationStatusColor(status);

    const getTitle = () => {
      switch (status) {
        case 'valid': return 'Valid email';
        case 'invalid': return 'Invalid email';
        case 'catch_all': return 'Catch-all domain';
        case 'risky': return 'Risky email';
        case 'verifying': return 'Verifying...';
        default: return 'Not verified';
      }
    };

    switch (icon) {
      case 'check':
        return <span title={getTitle()}><CheckCircle className={`w-4 h-4 ${colorClass}`} /></span>;
      case 'x':
        return <span title={getTitle()}><XCircle className={`w-4 h-4 ${colorClass}`} /></span>;
      case 'alert':
        return <span title={getTitle()}><AlertTriangle className={`w-4 h-4 ${colorClass}`} /></span>;
      case 'spinner':
        return <span title={getTitle()}><div className={`w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${colorClass}`} /></span>;
      default:
        return <span title={getTitle()}><HelpCircle className={`w-4 h-4 ${colorClass}`} /></span>;
    }
  };

  if (teamLoading || loading) {
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
              <th className="px-6 py-4 text-left">
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
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">
                Contact
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">
                Company
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">
                List
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">
                Added
              </th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-5">
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
                <td className="px-6 py-5">
                  <div className="space-y-1">
                    {/* Name fields */}
                    {editingCell?.leadId === lead.id && (editingCell.field === 'first_name' || editingCell.field === 'last_name') ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={editingCell.field === 'first_name' ? editInputRef : undefined}
                          type="text"
                          value={getDisplayValue(lead, 'first_name')}
                          onChange={(e) => handleCellChange(lead.id, 'first_name', e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={(e) => handleCellKeyDown(e, lead.id, 'first_name')}
                          placeholder="First"
                          onClick={(e) => { e.stopPropagation(); setEditingCell({ leadId: lead.id, field: 'first_name' }); }}
                          className={`w-[45%] px-1.5 py-0.5 text-sm font-medium border rounded focus:ring-1 focus:ring-primary/30 focus:border-primary bg-background text-foreground ${isFieldEdited(lead.id, 'first_name') ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                        />
                        <input
                          ref={editingCell.field === 'last_name' ? editInputRef : undefined}
                          type="text"
                          value={getDisplayValue(lead, 'last_name')}
                          onChange={(e) => handleCellChange(lead.id, 'last_name', e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={(e) => handleCellKeyDown(e, lead.id, 'last_name')}
                          placeholder="Last"
                          onClick={(e) => { e.stopPropagation(); setEditingCell({ leadId: lead.id, field: 'last_name' }); }}
                          className={`w-[45%] px-1.5 py-0.5 text-sm font-medium border rounded focus:ring-1 focus:ring-primary/30 focus:border-primary bg-background text-foreground ${isFieldEdited(lead.id, 'last_name') ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                        />
                      </div>
                    ) : (
                      <p
                        onClick={() => handleCellClick(lead.id, 'first_name')}
                        className={`font-medium cursor-pointer hover:underline hover:decoration-dashed hover:underline-offset-2 hover:decoration-muted-foreground/50 ${
                          isFieldEdited(lead.id, 'first_name') || isFieldEdited(lead.id, 'last_name')
                            ? 'text-primary border-l-2 border-primary pl-1.5'
                            : 'text-foreground'
                        }`}
                      >
                        {(() => {
                          const fn = getDisplayValue(lead, 'first_name');
                          const ln = getDisplayValue(lead, 'last_name');
                          return fn || ln ? `${fn} ${ln}`.trim() : '-';
                        })()}
                      </p>
                    )}
                    {/* Email field */}
                    {editingCell?.leadId === lead.id && editingCell.field === 'email' ? (
                      <input
                        ref={editInputRef}
                        type="email"
                        value={getDisplayValue(lead, 'email')}
                        onChange={(e) => handleCellChange(lead.id, 'email', e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => handleCellKeyDown(e, lead.id, 'email')}
                        className={`w-full px-1.5 py-0.5 text-sm border rounded focus:ring-1 focus:ring-primary/30 focus:border-primary bg-background text-foreground ${isFieldEdited(lead.id, 'email') ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <VerificationIcon status={lead.email_verification_status} />
                        <p
                          onClick={() => handleCellClick(lead.id, 'email')}
                          className={`text-sm cursor-pointer hover:underline hover:decoration-dashed hover:underline-offset-2 hover:decoration-muted-foreground/50 ${
                            isFieldEdited(lead.id, 'email')
                              ? 'text-primary border-l-2 border-primary pl-1.5'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {getDisplayValue(lead, 'email')}
                        </p>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="space-y-1">
                    {/* Company field */}
                    {editingCell?.leadId === lead.id && editingCell.field === 'company' ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={getDisplayValue(lead, 'company')}
                        onChange={(e) => handleCellChange(lead.id, 'company', e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => handleCellKeyDown(e, lead.id, 'company')}
                        placeholder="Company"
                        className={`w-full px-1.5 py-0.5 text-sm border rounded focus:ring-1 focus:ring-primary/30 focus:border-primary bg-background text-foreground ${isFieldEdited(lead.id, 'company') ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                      />
                    ) : (
                      <p
                        onClick={() => handleCellClick(lead.id, 'company')}
                        className={`cursor-pointer hover:underline hover:decoration-dashed hover:underline-offset-2 hover:decoration-muted-foreground/50 ${
                          isFieldEdited(lead.id, 'company')
                            ? 'text-primary border-l-2 border-primary pl-1.5'
                            : 'text-foreground'
                        }`}
                      >
                        {getDisplayValue(lead, 'company') || '-'}
                      </p>
                    )}
                    {/* Title field */}
                    {editingCell?.leadId === lead.id && editingCell.field === 'title' ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={getDisplayValue(lead, 'title')}
                        onChange={(e) => handleCellChange(lead.id, 'title', e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => handleCellKeyDown(e, lead.id, 'title')}
                        placeholder="Job title"
                        className={`w-full px-1.5 py-0.5 text-sm border rounded focus:ring-1 focus:ring-primary/30 focus:border-primary bg-background text-foreground ${isFieldEdited(lead.id, 'title') ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                      />
                    ) : (
                      <p
                        onClick={() => handleCellClick(lead.id, 'title')}
                        className={`text-sm cursor-pointer hover:underline hover:decoration-dashed hover:underline-offset-2 hover:decoration-muted-foreground/50 ${
                          isFieldEdited(lead.id, 'title')
                            ? 'text-primary border-l-2 border-primary pl-1.5'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {getDisplayValue(lead, 'title') || '-'}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="text-sm text-muted-foreground">
                    {lead.lead_lists?.name || '-'}
                  </span>
                </td>
                <td className="px-6 py-5">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getLeadStatusColor(lead.status)}`}>
                    {formatLeadStatus(lead.status)}
                  </span>
                </td>
                <td className="px-6 py-5 text-sm text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleVerifyEmail(lead.id)}
                      disabled={verifyingLead === lead.id || !accessToken}
                      className="p-2 text-muted-foreground hover:text-green-600 dark:hover:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 disabled:opacity-50 transition-colors"
                      title="Verify email"
                    >
                      {verifyingLead === lead.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </button>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent inline-block"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Link>
                  </div>
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

      {/* Floating Save Bar */}
      {editedLeads.size > 0 && (
        <div className="sticky bottom-4 mx-auto max-w-2xl animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center justify-between gap-4 px-6 py-3 bg-card border border-border rounded-xl shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium text-foreground">
                {editedLeads.size} lead{editedLeads.size !== 1 ? 's' : ''} modified
              </span>
              {saveError && (
                <span className="text-sm text-red-500">{saveError}</span>
              )}
              {saveSuccess && (
                <span className="text-sm text-green-600 dark:text-green-400">{saveSuccess}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscardAll}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Discard
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
