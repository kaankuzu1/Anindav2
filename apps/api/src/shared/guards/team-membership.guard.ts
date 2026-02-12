import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../database/database.module';

@Injectable()
export class TeamMembershipGuard implements CanActivate {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract team_id from query params or body
    const teamId = request.query?.team_id || request.body?.team_id;

    if (!teamId) {
      // No team_id specified — allow through (endpoint may not need it)
      return true;
    }

    const { data, error } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .limit(1);

    if (error || !data || data.length === 0) {
      throw new ForbiddenException('You are not a member of this team');
    }

    return true;
  }
}
