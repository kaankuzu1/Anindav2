'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';

export interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  users: {
    email: string;
    full_name: string | null;
  } | null;
}

export interface Team {
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

export interface Usage {
  inboxes: number;
  campaigns: number;
  teamMembers: number;
  emailsSentToday: number;
}

export function useSettingsAuth() {
  const supabase = createClient();
  const { teamId, loading: teamLoading, accessToken } = useTeam();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [usage, setUsage] = useState<Usage>({ inboxes: 0, campaigns: 0, teamMembers: 0, emailsSentToday: 0 });

  useEffect(() => {
    if (teamLoading) return;
    if (!teamId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      // Get current user info for display
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser({ id: user.id, email: user.email || '' });
      }

      // Fetch team data
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId!)
        .single() as { data: Team | null };

      if (teamData) {
        setTeam(teamData);
      }

      // Fetch members
      const { data: membersData } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          created_at,
          users(email, full_name)
        `)
        .eq('team_id', teamId!)
        .order('created_at', { ascending: true }) as { data: TeamMember[] | null };

      setMembers(membersData || []);

      // Fetch usage
      const [inboxCount, campaignCount, emailCount] = await Promise.all([
        supabase.from('inboxes').select('*', { count: 'exact', head: true }).eq('team_id', teamId!),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('team_id', teamId!),
        supabase.from('emails').select('*', { count: 'exact', head: true })
          .eq('team_id', teamId!)
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
  }, [teamId, teamLoading]);

  return { currentUser, team, setTeam, members, setMembers, usage, accessToken, loading: teamLoading || loading, supabase };
}
