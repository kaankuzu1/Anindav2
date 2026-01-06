import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

@Injectable()
export class AuthService {
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
}
