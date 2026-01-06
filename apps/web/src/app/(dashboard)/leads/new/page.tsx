'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, UserPlus, Save } from 'lucide-react';

interface LeadList {
  id: string;
  name: string;
}

export default function NewLeadPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [selectedListId, setSelectedListId] = useState('');

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
        const tid = teamMembers[0].team_id;
        setTeamId(tid);

        const { data: lists } = await supabase
          .from('lead_lists')
          .select('id, name')
          .eq('team_id', tid)
          .order('created_at', { ascending: false });

        setLeadLists(lists ?? []);
      }

      setLoading(false);
    }

    fetchData();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !email) return;

    setError(null);
    setSaving(true);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Check if email already exists
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('team_id', teamId)
        .eq('email', email.toLowerCase())
        .single();

      if (existing) {
        throw new Error('A lead with this email already exists');
      }

      // Create the lead
      const { data: lead, error: insertError } = await (supabase
        .from('leads') as any)
        .insert({
          team_id: teamId,
          email: email.toLowerCase(),
          first_name: firstName || null,
          last_name: lastName || null,
          company: company || null,
          title: title || null,
          phone: phone || null,
          linkedin_url: linkedinUrl || null,
          website: website || null,
          lead_list_id: selectedListId || null,
          status: 'pending',
          custom_fields: {},
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update lead list count if assigned to a list
      if (selectedListId) {
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('lead_list_id', selectedListId);

        await (supabase
          .from('lead_lists') as any)
          .update({ lead_count: count ?? 0 })
          .eq('id', selectedListId);
      }

      router.push('/leads');
    } catch (err) {
      console.error('Failed to create lead:', err);
      setError(err instanceof Error ? err.message : 'Failed to create lead. Please try again.');
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
    <div className="max-w-2xl mx-auto">
      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leads
      </Link>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">Add New Lead</h1>
          <p className="text-muted-foreground mt-1">Add a single lead to your database</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Email (Required) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Company & Title */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc"
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VP of Sales"
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* LinkedIn URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              LinkedIn URL
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/johndoe"
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://company.com"
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Lead List */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Add to List
            </label>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">No list (standalone lead)</option>
              {leadLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
            {leadLists.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                No lead lists found. You can{' '}
                <Link href="/leads/lists/new" className="text-primary hover:underline">
                  create one
                </Link>{' '}
                or add this lead without a list.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
            <Link href="/leads" className="px-4 py-2 text-muted-foreground hover:text-foreground">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !email}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Add Lead
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
