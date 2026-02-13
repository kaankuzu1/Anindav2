'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import {
  ArrowLeft,
  Save,
  Trash2,
  Mail,
  Building,
  Briefcase,
  Phone,
  Linkedin,
  Globe,
  Calendar,
  Clock,
  MessageSquare,
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getLeadStatusColor,
  getVerificationBadgeColor,
  getVerificationIcon,
  formatLeadStatus,
  getRiskScoreColor,
  getRiskLevel,
} from '@/lib/lead-status';

interface Lead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  status: string;
  lead_list_id: string | null;
  created_at: string;
  updated_at: string;
  first_contacted_at: string | null;
  last_contacted_at: string | null;
  replied_at: string | null;
  lead_lists?: { id: string; name: string } | null;
  email_verification_status: string | null;
  email_risk_score: number | null;
  email_verified_at: string | null;
  analysis_notes: string | null;
}

interface LeadList {
  id: string;
  name: string;
}

interface EmailActivity {
  id: string;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;
  const supabase = createClient();

  const { teamId, loading: teamLoading } = useTeam();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [emailActivity, setEmailActivity] = useState<EmailActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Editable fields
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [status, setStatus] = useState('pending');
  const [analysisNotes, setAnalysisNotes] = useState('');

  useEffect(() => {
    if (teamLoading || !teamId) return;

    async function fetchData() {
      // Fetch lead
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*, lead_lists(id, name)')
        .eq('id', leadId)
        .eq('team_id', teamId!)
        .single();

      if (leadError || !leadData) {
        router.push('/leads');
        return;
      }

      const lead = leadData as Lead;
      setLead(lead);
      setEmail(lead.email || '');
      setFirstName(lead.first_name || '');
      setLastName(lead.last_name || '');
      setCompany(lead.company || '');
      setTitle(lead.title || '');
      setPhone(lead.phone || '');
      setLinkedinUrl(lead.linkedin_url || '');
      setWebsite(lead.website || '');
      setSelectedListId(lead.lead_list_id || '');
      setStatus(lead.status || 'pending');
      setAnalysisNotes(lead.analysis_notes || '');

      // Fetch lead lists
      const { data: lists } = await supabase
        .from('lead_lists')
        .select('id, name')
        .eq('team_id', teamId!)
        .order('created_at', { ascending: false });

      setLeadLists(lists ?? []);

      // Fetch email activity
      const { data: emails } = await supabase
        .from('emails')
        .select('id, subject, status, sent_at, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(10);

      setEmailActivity(emails ?? []);

      setLoading(false);
    }

    fetchData();
  }, [teamId, teamLoading, leadId]);

  const handleSave = async () => {
    if (!teamId || !lead) return;

    setError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Check if email changed and already exists
      if (email.toLowerCase() !== lead.email.toLowerCase()) {
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('team_id', teamId)
          .eq('email', email.toLowerCase())
          .neq('id', leadId)
          .single();

        if (existing) {
          throw new Error('A lead with this email already exists');
        }
      }

      const oldListId = lead.lead_list_id;
      const newListId = selectedListId || null;

      // Update the lead
      const { error: updateError } = await (supabase
        .from('leads') as any)
        .update({
          email: email.toLowerCase(),
          first_name: firstName || null,
          last_name: lastName || null,
          company: company || null,
          title: title || null,
          phone: phone || null,
          linkedin_url: linkedinUrl || null,
          website: website || null,
          lead_list_id: newListId,
          status,
          analysis_notes: analysisNotes || null,
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      // Update lead list counts if list changed
      if (oldListId !== newListId) {
        if (oldListId) {
          const { count: oldCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('lead_list_id', oldListId);

          await (supabase
            .from('lead_lists') as any)
            .update({ lead_count: oldCount ?? 0 })
            .eq('id', oldListId);
        }

        if (newListId) {
          const { count: newCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('lead_list_id', newListId);

          await (supabase
            .from('lead_lists') as any)
            .update({ lead_count: newCount ?? 0 })
            .eq('id', newListId);
        }
      }

      // Refresh lead data
      const { data: updatedLead } = await supabase
        .from('leads')
        .select('*, lead_lists(id, name)')
        .eq('id', leadId)
        .single();

      if (updatedLead) {
        setLead(updatedLead as unknown as Lead);
      }
      setSuccessMessage('Lead updated successfully');
    } catch (err) {
      console.error('Failed to update lead:', err);
      setError(err instanceof Error ? err.message : 'Failed to update lead. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!teamId || !lead) return;
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return;

    setDeleting(true);

    try {
      const listId = lead.lead_list_id;

      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (deleteError) throw deleteError;

      // Update lead list count
      if (listId) {
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('lead_list_id', listId);

        await (supabase
          .from('lead_lists') as any)
          .update({ lead_count: count ?? 0 })
          .eq('id', listId);
      }

      router.push('/leads');
    } catch (err) {
      console.error('Failed to delete lead:', err);
      setError('Failed to delete lead. Please try again.');
      setDeleting(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!teamId || !lead) return;

    setVerifying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/leads/${lead.id}/verify?team_id=${teamId}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to verify email');
      }

      const result = await response.json();

      // Update local state with verification result
      setLead({
        ...lead,
        email_verification_status: result.verification.status,
        email_risk_score: result.verification.riskScore,
        email_verified_at: new Date().toISOString(),
      });

      setSuccessMessage(`Email verified: ${result.verification.status}${result.verification.riskScore ? ` (Risk: ${result.verification.riskScore})` : ''}`);
    } catch (err) {
      console.error('Failed to verify email:', err);
      setError('Failed to verify email. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Helper to render verification icon
  const VerificationIcon = ({ status, size = 'w-4 h-4' }: { status: string | null; size?: string }) => {
    const icon = getVerificationIcon(status);

    switch (icon) {
      case 'check':
        return <CheckCircle className={`${size} text-green-600 dark:text-green-400`} />;
      case 'x':
        return <XCircle className={`${size} text-red-600 dark:text-red-400`} />;
      case 'alert':
        return <AlertTriangle className={`${size} text-yellow-600 dark:text-yellow-400`} />;
      case 'spinner':
        return <div className={`${size} border-2 border-blue-600 border-t-transparent rounded-full animate-spin`} />;
      default:
        return <HelpCircle className={`${size} text-gray-400`} />;
    }
  };

  const getEmailStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'text-green-600';
      case 'opened':
        return 'text-blue-600';
      case 'clicked':
        return 'text-purple-600';
      case 'bounced':
      case 'failed':
        return 'text-red-600';
      case 'queued':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  if (loading || teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Lead not found</p>
        <Link href="/leads" className="text-primary hover:underline mt-2 inline-block">
          Back to Leads
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leads
      </Link>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Lead Details Card */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {firstName || lastName
                    ? `${firstName || ''} ${lastName || ''}`.trim()
                    : lead.email}
                </h1>
                <p className="text-gray-500">{lead.email}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLeadStatusColor(status)}`}>
                {formatLeadStatus(status)}
              </span>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-600">{successMessage}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Company & Title */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Building className="w-4 h-4 inline mr-1" />
                    Company
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* LinkedIn & Website */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Linkedin className="w-4 h-4 inline mr-1" />
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4 inline mr-1" />
                    Website
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Analysis Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Analysis Notes
                </label>
                <textarea
                  value={analysisNotes}
                  onChange={(e) => setAnalysisNotes(e.target.value)}
                  placeholder="Add research notes about this lead for AI personalization..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                />
              </div>

              {/* Status & List */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_sequence">In Sequence</option>
                    <option value="contacted">Contacted</option>
                    <option value="replied">Replied</option>
                    <option value="interested">Interested</option>
                    <option value="meeting_booked">Meeting Booked</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="bounced">Bounced</option>
                    <option value="unsubscribed">Unsubscribed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lead List
                  </label>
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">No list</option>
                    {leadLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Delete Lead'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Email Verification */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Email Verification
              </h3>
              <button
                onClick={handleVerifyEmail}
                disabled={verifying}
                className="text-sm text-primary hover:text-primary/80 disabled:opacity-50 flex items-center gap-1"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Verify
                  </>
                )}
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getVerificationBadgeColor(lead.email_verification_status)}`}>
                  <VerificationIcon status={lead.email_verification_status} size="w-3 h-3" />
                  {lead.email_verification_status ? lead.email_verification_status.replace('_', ' ') : 'Unverified'}
                </span>
              </div>
              {lead.email_risk_score !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Risk Score</span>
                  <span className={`text-sm font-medium ${getRiskScoreColor(lead.email_risk_score)}`}>
                    {lead.email_risk_score}/100 ({getRiskLevel(lead.email_risk_score)})
                  </span>
                </div>
              )}
              {lead.email_verified_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Verified</span>
                  <span className="text-sm text-gray-700">
                    {new Date(lead.email_verified_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Created</p>
                  <p className="font-medium">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {lead.first_contacted_at && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">First Contacted</p>
                    <p className="font-medium">
                      {new Date(lead.first_contacted_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
              {lead.last_contacted_at && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">Last Contacted</p>
                    <p className="font-medium">
                      {new Date(lead.last_contacted_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
              {lead.replied_at && (
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-gray-500">Replied</p>
                    <p className="font-medium">
                      {new Date(lead.replied_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Email Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Email Activity</h3>
            {emailActivity.length > 0 ? (
              <div className="space-y-3">
                {emailActivity.map((activity) => (
                  <div key={activity.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {activity.subject || '(No subject)'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-medium capitalize ${getEmailStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {activity.sent_at
                          ? new Date(activity.sent_at).toLocaleDateString()
                          : new Date(activity.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No emails sent yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
