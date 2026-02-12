'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, Crown, Clock } from 'lucide-react';
import { useSettingsAuth } from '@/hooks/use-settings-auth';
import { SettingsSubPageLayout } from '@/components/settings/settings-sub-page-layout';

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  invited_at?: string | null;
  users?: {
    email: string;
    full_name: string | null;
  } | null;
}

export default function MembersSettingsPage() {
  const { team, currentUser, loading: authLoading, accessToken } = useSettingsAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchMembers = useCallback(async () => {
    if (!team?.id || !accessToken) return;
    setLoadingMembers(true);
    try {
      const res = await fetch(`${apiUrl}/auth/team/members?team_id=${team.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'Failed to load members';
        try { msg = JSON.parse(text).message || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      setMembers(data);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to load members');
    } finally {
      setLoadingMembers(false);
    }
  }, [team?.id, accessToken]);

  useEffect(() => {
    if (team?.id && accessToken) {
      fetchMembers();
    }
  }, [team?.id, accessToken, fetchMembers]);

  const handleInviteMember = async () => {
    if (!team || !inviteEmail.trim()) return;
    setInviting(true);
    setFeedback(null);

    try {
      const res = await fetch(`${apiUrl}/auth/team/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ team_id: team.id, email: inviteEmail.trim().toLowerCase() }),
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = 'Failed to invite member';
        try { msg = JSON.parse(text).message || msg; } catch {}
        throw new Error(msg);
      }

      setInviteEmail('');
      showFeedback('success', 'Member invited successfully');
      fetchMembers();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!team || userId === currentUser?.id) return;
    if (!confirm('Are you sure you want to remove this team member?')) return;

    setRemoving(memberId);
    setFeedback(null);

    try {
      const res = await fetch(`${apiUrl}/auth/team/members/${memberId}?team_id=${team.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = 'Failed to remove member';
        try { msg = JSON.parse(text).message || msg; } catch {}
        throw new Error(msg);
      }

      setMembers(members.filter((m) => m.id !== memberId));
      showFeedback('success', 'Member removed');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to remove member');
    } finally {
      setRemoving(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <SettingsSubPageLayout title="Members" description="Manage your team members">
        <p className="text-gray-500 dark:text-gray-400">No team found.</p>
      </SettingsSubPageLayout>
    );
  }

  return (
    <SettingsSubPageLayout title="Members" description="Manage your team members">
      {/* Feedback message */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Invite Member */}
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invite Team Member</h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInviteMember()}
              placeholder="colleague@company.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={handleInviteMember}
            disabled={inviting || !inviteEmail.trim()}
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
        {loadingMembers ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{member.users?.email}</p>
                      {member.invited_at && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <Clock className="w-3 h-3" />
                          Joined {new Date(member.invited_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
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
                    <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">{member.role}</span>
                  )}
                  {member.user_id !== currentUser?.id && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.id, member.user_id)}
                      disabled={removing === member.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsSubPageLayout>
  );
}
