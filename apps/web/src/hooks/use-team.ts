'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface TeamData {
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

export function useTeam() {
  const router = useRouter();
  const supabase = createClient();

  const [teamId, setTeamId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string>('');

  const fetchTeam = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      setAccessToken(session.access_token);
    }

    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .limit(1) as { data: { team_id: string; role: string }[] | null };

    if (!teamMembers || teamMembers.length === 0) {
      setLoading(false);
      return;
    }

    const tid = teamMembers[0].team_id;
    setTeamId(tid);

    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', tid)
      .single() as { data: TeamData | null };

    if (teamData) {
      setTeam(teamData);
    }

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchTeam();
  }, [fetchTeam]);

  return { teamId, team, loading, accessToken, refetch };
}
