import { Injectable, Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  async login(username: string, password: string): Promise<{ token: string }> {
    const adminUsername = this.configService.getOrThrow<string>('ADMIN_USERNAME');
    const adminPassword = this.configService.getOrThrow<string>('ADMIN_PASSWORD');
    const jwtSecret = this.configService.getOrThrow<string>('ADMIN_JWT_SECRET');

    if (username !== adminUsername || password !== adminPassword) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '24h' });
    return { token };
  }

  async getDashboardStats() {
    // Admin inbox stats
    const { data: adminInboxes } = await this.supabase
      .from('admin_inboxes')
      .select('id, status, max_capacity, current_load, sent_today, received_today');

    const totalAdminInboxes = adminInboxes?.length ?? 0;
    const activeAdminInboxes = adminInboxes?.filter(i => i.status === 'active').length ?? 0;
    const errorAdminInboxes = adminInboxes?.filter(i => i.status === 'error').length ?? 0;

    let totalCapacity = 0;
    let totalLoad = 0;
    let totalSentToday = 0;
    let totalReceivedToday = 0;

    for (const inbox of adminInboxes ?? []) {
      totalCapacity += inbox.max_capacity;
      totalLoad += inbox.current_load;
      totalSentToday += inbox.sent_today;
      totalReceivedToday += inbox.received_today;
    }

    // Count users using network warmup
    const { count: networkUserCount } = await this.supabase
      .from('warmup_state')
      .select('inbox_id', { count: 'exact', head: true })
      .eq('warmup_mode', 'network')
      .eq('enabled', true);

    // Return structured response matching DashboardStatsExtended interface
    return {
      // Legacy flat fields for backward compatibility
      totalAdminInboxes,
      activeAdminInboxes,
      errorAdminInboxes,
      totalCapacity,
      totalLoad,
      networkUsersCount: networkUserCount ?? 0,
      // Extended structured fields
      adminInboxes: {
        total: totalAdminInboxes,
        active: activeAdminInboxes,
        error: errorAdminInboxes,
      },
      capacity: {
        total: totalCapacity,
        used: totalLoad,
        available: totalCapacity - totalLoad,
        utilizationPercent: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0,
      },
      today: {
        sent: totalSentToday,
        received: totalReceivedToday,
      },
      networkUsers: networkUserCount ?? 0,
    };
  }

  async getNetworkUsers() {
    const { data, error } = await this.supabase
      .from('warmup_state')
      .select(`
        inbox_id,
        enabled,
        phase,
        current_day,
        sent_today,
        warmup_mode,
        inbox:inboxes(id, email, provider, status, health_score, team_id)
      `)
      .eq('warmup_mode', 'network')
      .eq('enabled', true);

    if (error) {
      this.logger.error('Failed to fetch network users:', error.message);
      return [];
    }

    // Enrich with assignment info
    const result = [];
    for (const ws of data ?? []) {
      const inbox = ws.inbox as any;
      if (!inbox) continue;

      const { data: assignments } = await this.supabase
        .from('admin_inbox_assignments')
        .select('admin_inbox_id, admin_inboxes(email, status, health_score)')
        .eq('inbox_id', inbox.id);

      // Get the first assignment (primary admin inbox)
      const primaryAssignment = assignments?.[0] as any;

      // Return structure matching frontend NetworkUser interface
      result.push({
        inbox_id: inbox.id,
        inbox_email: inbox.email,
        team_id: inbox.team_id,
        warmup_mode: ws.warmup_mode,
        current_day: ws.current_day,
        phase: ws.phase,
        admin_inbox_email: primaryAssignment?.admin_inboxes?.email ?? null,
        admin_inbox_id: primaryAssignment?.admin_inbox_id ?? null,
        // Additional useful fields
        provider: inbox.provider,
        status: inbox.status,
        health_score: inbox.health_score,
        sent_today: ws.sent_today,
        assignments: (assignments ?? []).map((a: any) => ({
          admin_inbox_id: a.admin_inbox_id,
          admin_email: a.admin_inboxes?.email,
          admin_status: a.admin_inboxes?.status,
          admin_health_score: a.admin_inboxes?.health_score,
        })),
      });
    }

    return result;
  }
}
