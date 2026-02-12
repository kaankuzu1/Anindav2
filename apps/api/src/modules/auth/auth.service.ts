import { Injectable, Inject, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async getUserById(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  async getUserTeams(userId: string) {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('team_id, role, teams(*)')
      .eq('user_id', userId);

    if (error) {
      return [];
    }

    return data;
  }

  async createUserProfile(userId: string, email: string, fullName?: string) {
    const { data, error } = await this.supabase
      .from('users')
      .upsert({
        id: userId,
        email,
        full_name: fullName,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async getTeamMembers(teamId: string) {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('*, users(email, full_name)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch team members: ${error.message}`);
      return [];
    }

    return data;
  }

  async validateTeamMembership(userId: string, teamId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .single();

    return !!data;
  }

  async inviteMember(teamId: string, inviterUserId: string, inviteeEmail: string) {
    // Look up invitee by email
    const { data: invitee } = await this.supabase
      .from('users')
      .select('id, email')
      .eq('email', inviteeEmail)
      .single();

    if (!invitee) {
      throw new NotFoundException('User not found. They need to sign up first.');
    }

    // Check if already in this team
    const { data: existing } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', invitee.id)
      .single();

    if (existing) {
      throw new ConflictException('User is already a member of this team.');
    }

    // Remove invitee from their current team(s)
    const { data: oldMemberships } = await this.supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', invitee.id);

    const oldTeamIds = (oldMemberships || []).map(m => m.team_id);

    if (oldTeamIds.length > 0) {
      await this.supabase
        .from('team_members')
        .delete()
        .eq('user_id', invitee.id);

      // Delete orphaned teams (teams with 0 members after removal)
      for (const oldTeamId of oldTeamIds) {
        const { count } = await this.supabase
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', oldTeamId);

        if (count === 0) {
          await this.supabase.from('teams').delete().eq('id', oldTeamId);
          this.logger.log(`Deleted orphaned team ${oldTeamId}`);
        }
      }
    }

    // Insert into new team
    const { data: membership, error } = await this.supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: invitee.id,
        role: 'member',
        invited_by: inviterUserId,
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      })
      .select('*, users(email, full_name)')
      .single();

    if (error) {
      this.logger.error(`Failed to invite member: ${error.message}`);
      throw new BadRequestException('Failed to add member to team.');
    }

    this.logger.log(`User ${inviteeEmail} invited to team ${teamId} by ${inviterUserId}`);
    return membership;
  }

  async removeMember(teamId: string, memberUserId: string, requestingUserId: string) {
    if (memberUserId === requestingUserId) {
      throw new BadRequestException('You cannot remove yourself from the team.');
    }

    // Delete from team_members
    const { error: deleteError } = await this.supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', memberUserId);

    if (deleteError) {
      this.logger.error(`Failed to remove member: ${deleteError.message}`);
      throw new BadRequestException('Failed to remove member from team.');
    }

    // Create a new personal team for the removed user
    const { data: newTeam, error: teamError } = await this.supabase
      .from('teams')
      .insert({ name: 'Personal' })
      .select()
      .single();

    if (teamError) {
      this.logger.error(`Failed to create personal team for removed user: ${teamError.message}`);
      throw new BadRequestException('Failed to create personal team for removed user.');
    }

    await this.supabase
      .from('team_members')
      .insert({
        team_id: newTeam.id,
        user_id: memberUserId,
        role: 'owner',
      });

    this.logger.log(`User ${memberUserId} removed from team ${teamId}, assigned to new personal team ${newTeam.id}`);
    return { success: true };
  }
}
