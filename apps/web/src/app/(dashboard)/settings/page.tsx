'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Building2,
  Users,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  Crown,
  AlertCircle,
  Sparkles,
  Palette,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  users: {
    email: string;
    full_name: string | null;
  } | null;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  plan: string;
  daily_email_limit: number;
  max_inboxes: number;
  max_campaigns: number;
  max_team_members: number;
  company_name: string | null;
  physical_address: string | null;
}

interface Usage {
  inboxes: number;
  campaigns: number;
  teamMembers: number;
  emailsSentToday: number;
}

interface AISettings {
  enabled: boolean;
  defaultTone: 'professional' | 'friendly' | 'casual' | 'short';
  autoIntentDetection: boolean;
  autoSpamCheck: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [usage, setUsage] = useState<Usage>({ inboxes: 0, campaigns: 0, teamMembers: 0, emailsSentToday: 0 });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'members' | 'billing' | 'ai' | 'appearance'>('profile');
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>({
    enabled: true,
    defaultTone: 'professional',
    autoIntentDetection: true,
    autoSpamCheck: true,
  });
  const [savingAi, setSavingAi] = useState(false);

  // Track mounted state for theme (prevents hydration mismatch)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load AI settings from localStorage
  useEffect(() => {
    const savedAiSettings = localStorage.getItem('aiSettings');
    if (savedAiSettings) {
      try {
        setAiSettings(JSON.parse(savedAiSettings));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Editable fields
  const [teamName, setTeamName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      setCurrentUser({ id: user.id, email: user.email || '' });

      // Get team membership
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .limit(1) as { data: { team_id: string; role: string }[] | null };

      if (!teamMembers || teamMembers.length === 0) {
        setLoading(false);
        return;
      }

      const teamId = teamMembers[0].team_id;

      // Fetch team details
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single() as { data: Team | null };

      if (teamData) {
        setTeam(teamData);
        setTeamName(teamData.name);
        setCompanyName(teamData.company_name || '');
        setPhysicalAddress(teamData.physical_address || '');
      }

      // Fetch team members with user info
      const { data: membersData } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          created_at,
          users(email, full_name)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: true }) as { data: TeamMember[] | null };

      setMembers(membersData || []);

      // Fetch usage
      const [inboxCount, campaignCount, emailCount] = await Promise.all([
        supabase.from('inboxes').select('*', { count: 'exact', head: true }).eq('team_id', teamId),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('team_id', teamId),
        supabase.from('emails').select('*', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .gte('sent_at', new Date().toISOString().split('T')[0]),
      ]);

      setUsage({
        inboxes: inboxCount.count || 0,
        campaigns: campaignCount.count || 0,
        teamMembers: membersData?.length || 0,
        emailsSentToday: emailCount.count || 0,
      });

      setLoading(false);
    }

    fetchData();
  }, [supabase, router]);

  const handleSaveTeam = async () => {
    if (!team) return;
    setSaving(true);

    await (supabase.from('teams') as any)
      .update({
        name: teamName,
        company_name: companyName || null,
        physical_address: physicalAddress || null,
      })
      .eq('id', team.id);

    setTeam({ ...team, name: teamName, company_name: companyName, physical_address: physicalAddress });
    setSaving(false);
  };

  const handleInviteMember = async () => {
    if (!team || !inviteEmail) return;
    setInviting(true);

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', inviteEmail.toLowerCase())
      .single() as { data: { id: string } | null };

    if (existingUser) {
      // Add to team
      await (supabase.from('team_members') as any).insert({
        team_id: team.id,
        user_id: existingUser.id,
        role: inviteRole,
      });

      // Refresh members
      const { data: membersData } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          created_at,
          users(email, full_name)
        `)
        .eq('team_id', team.id)
        .order('created_at', { ascending: true }) as { data: TeamMember[] | null };

      setMembers(membersData || []);
      setInviteEmail('');
    } else {
      alert('User not found. They need to sign up first.');
    }

    setInviting(false);
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!team || userId === currentUser?.id) return;

    if (!confirm('Are you sure you want to remove this team member?')) return;

    await supabase.from('team_members').delete().eq('id', memberId);

    setMembers(members.filter((m) => m.id !== memberId));
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    await (supabase.from('team_members') as any)
      .update({ role: newRole })
      .eq('id', memberId);

    setMembers(members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'pro':
        return 'bg-blue-100 text-blue-800';
      case 'starter':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your account and team settings</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-[#353b48]">
        <nav className="flex gap-4">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'team', label: 'Team', icon: Building2 },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'billing', label: 'Billing & Usage', icon: Shield },
            { id: 'ai', label: 'AI Features', icon: Sparkles },
            { id: 'appearance', label: 'Appearance', icon: Palette },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={currentUser?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-gray-50 dark:bg-[#2e3340] text-gray-500 dark:text-gray-400"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
            </div>
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && team && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company name (for email compliance)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Physical Address</label>
                <textarea
                  value={physicalAddress}
                  onChange={(e) => setPhysicalAddress(e.target.value)}
                  placeholder="Required for CAN-SPAM compliance"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <button
                onClick={handleSaveTeam}
                disabled={saving}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && team && (
        <div className="space-y-6">
          {/* Invite Member */}
          <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invite Team Member</h2>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleInviteMember}
                disabled={inviting || !inviteEmail}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {inviting ? 'Inviting...' : 'Invite'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              The user must have an account to be added to your team.
            </p>
          </div>

          {/* Members List */}
          <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#353b48]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members ({members.length})</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {members.map((member) => (
                <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-[#353b48] rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {member.users?.email?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {member.users?.full_name || member.users?.email || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{member.users?.email}</p>
                    </div>
                    {member.user_id === currentUser?.id && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 px-2 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {member.role === 'owner' ? (
                      <span className="flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-500">
                        <Crown className="w-4 h-4" />
                        Owner
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value)}
                        disabled={member.user_id === currentUser?.id}
                        className="text-sm border border-gray-300 dark:border-[#404654] rounded-lg px-2 py-1 bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                    {member.user_id !== currentUser?.id && member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.id, member.user_id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && team && (
        <div className="space-y-6">
          {/* Current Plan */}
          <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getPlanColor(team.plan)}`}>
                  {team.plan}
                </span>
                <span className="text-gray-500 dark:text-gray-400">Plan</span>
              </div>
              <button className="text-primary hover:text-primary/80 text-sm font-medium">
                Upgrade Plan
              </button>
            </div>
          </div>

          {/* Usage */}
          <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Usage</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Daily Emails</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {usage.emailsSentToday} / {team.daily_email_limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[#353b48] rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min((usage.emailsSentToday / team.daily_email_limit) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Connected Inboxes</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {usage.inboxes} / {team.max_inboxes}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[#353b48] rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${Math.min((usage.inboxes / team.max_inboxes) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Active Campaigns</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {usage.campaigns} / {team.max_campaigns}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[#353b48] rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${Math.min((usage.campaigns / team.max_campaigns) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Team Members</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {usage.teamMembers} / {team.max_team_members}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[#353b48] rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-purple-500"
                    style={{ width: `${Math.min((usage.teamMembers / team.max_team_members) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/50 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-400">Danger Zone</h3>
                <p className="text-sm text-red-700 dark:text-red-400/80 mt-1">
                  Once you delete your team, all data will be permanently removed. This action cannot be undone.
                </p>
                <button className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                  Delete Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Features Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* AI Settings */}
          <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-primary to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Features</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Configure AI-powered features for your team</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Main Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#2e3340] rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Enable AI Features</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Turn on AI-powered assistance across the platform</p>
                </div>
                <button
                  onClick={() => setAiSettings({ ...aiSettings, enabled: !aiSettings.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    aiSettings.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-[#404654]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      aiSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Default Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default AI Tone</label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Choose the default tone for AI-generated content. You can override this for individual requests.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { value: 'professional', label: 'Professional', desc: 'Formal & business-like' },
                    { value: 'friendly', label: 'Friendly', desc: 'Warm & approachable' },
                    { value: 'casual', label: 'Casual', desc: 'Relaxed & informal' },
                    { value: 'short', label: 'Concise', desc: 'Brief & to-the-point' },
                  ].map((tone) => (
                    <button
                      key={tone.value}
                      onClick={() => setAiSettings({ ...aiSettings, defaultTone: tone.value as AISettings['defaultTone'] })}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        aiSettings.defaultTone === tone.value
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary'
                          : 'border-gray-200 dark:border-[#353b48] hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <p className="font-medium text-gray-900 dark:text-white">{tone.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tone.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Intent Detection */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-[#353b48]">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Auto Intent Detection</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Automatically analyze and label incoming replies</p>
                </div>
                <button
                  onClick={() => setAiSettings({ ...aiSettings, autoIntentDetection: !aiSettings.autoIntentDetection })}
                  disabled={!aiSettings.enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    aiSettings.autoIntentDetection && aiSettings.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-[#404654]'
                  } ${!aiSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      aiSettings.autoIntentDetection && aiSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Auto Spam Check */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-[#353b48]">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Auto Spam Check</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Automatically check emails for spam triggers before sending</p>
                </div>
                <button
                  onClick={() => setAiSettings({ ...aiSettings, autoSpamCheck: !aiSettings.autoSpamCheck })}
                  disabled={!aiSettings.enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    aiSettings.autoSpamCheck && aiSettings.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-[#404654]'
                  } ${!aiSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      aiSettings.autoSpamCheck && aiSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-gray-200 dark:border-[#353b48]">
                <button
                  onClick={async () => {
                    setSavingAi(true);
                    // In a real implementation, save to database
                    // For now, just simulate save with localStorage
                    localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    setSavingAi(false);
                  }}
                  disabled={savingAi}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingAi ? 'Saving...' : 'Save AI Settings'}
                </button>
              </div>
            </div>
          </div>

          {/* AI Usage Info */}
          <div className="bg-gradient-to-r from-primary/5 to-purple-50 dark:from-primary/10 dark:to-purple-900/20 rounded-xl border border-primary/20 dark:border-primary/30 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">AI Features Available</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: 'Reply Assistant', desc: 'Generate contextual email replies' },
                { name: 'Intent Detection', desc: 'Classify lead responses automatically' },
                { name: 'Campaign Generator', desc: 'Create email sequences with AI' },
                { name: 'Spam Risk Checker', desc: 'Check deliverability before sending' },
                { name: 'Follow-Up Generator', desc: 'Create smart follow-up emails' },
                { name: 'Daily Summary', desc: 'AI-powered inbox activity overview' },
              ].map((feature) => (
                <li key={feature.name} className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{feature.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{feature.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-pink-500 rounded-lg flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Customize how the app looks</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme</label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Select your preferred color theme for the interface
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'light', label: 'Light', icon: Sun, desc: 'Always use light mode' },
                    { value: 'dark', label: 'Dark', icon: Moon, desc: 'Always use dark mode' },
                    { value: 'system', label: 'System', icon: Monitor, desc: 'Match your OS setting' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        theme === option.value
                          ? 'border-primary bg-primary/5 dark:bg-primary/10'
                          : 'border-gray-200 dark:border-[#353b48] hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {/* Theme preview */}
                      <div className={`w-full h-16 rounded-lg mb-3 overflow-hidden border ${
                        option.value === 'dark'
                          ? 'bg-gray-900 border-gray-700'
                          : option.value === 'light'
                          ? 'bg-white border-gray-200'
                          : 'bg-gradient-to-r from-white to-gray-900 border-gray-300'
                      }`}>
                        <div className="flex h-full">
                          {option.value === 'system' ? (
                            <>
                              <div className="w-1/2 bg-white p-2">
                                <div className="w-full h-2 bg-gray-200 rounded mb-1"></div>
                                <div className="w-3/4 h-2 bg-gray-200 rounded"></div>
                              </div>
                              <div className="w-1/2 bg-gray-900 p-2">
                                <div className="w-full h-2 bg-gray-700 rounded mb-1"></div>
                                <div className="w-3/4 h-2 bg-gray-700 rounded"></div>
                              </div>
                            </>
                          ) : (
                            <div className={`w-full p-2 ${option.value === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
                              <div className={`w-full h-2 rounded mb-1 ${option.value === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                              <div className={`w-3/4 h-2 rounded ${option.value === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <option.icon className={`w-4 h-4 ${theme === option.value ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`} />
                        <span className={`font-medium ${theme === option.value ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                          {option.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</p>

                      {theme === option.value && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {mounted && (
                <div className="pt-4 border-t border-gray-200 dark:border-[#353b48]">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Currently using: <span className="font-medium text-gray-900 dark:text-white capitalize">{resolvedTheme}</span> mode
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
