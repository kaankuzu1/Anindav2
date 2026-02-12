import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { encrypt, decrypt } from '@aninda/shared';
import { GmailClient, MicrosoftClient, testSmtpConnection } from '@aninda/email-client';

@Injectable()
export class AdminInboxesService {
  private readonly logger = new Logger(AdminInboxesService.name);
  private encryptionKey: string;

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async listAdminInboxes() {
    const { data, error } = await this.supabase
      .from('admin_inboxes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with assignment counts
    const result = [];
    for (const inbox of data ?? []) {
      const { count } = await this.supabase
        .from('admin_inbox_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('admin_inbox_id', inbox.id);

      result.push({
        ...inbox,
        oauth_access_token: undefined,
        oauth_refresh_token: undefined,
        smtp_pass: undefined,
        assignment_count: count ?? 0,
      });
    }

    return result;
  }

  async getAdminInbox(id: string) {
    const { data, error } = await this.supabase
      .from('admin_inboxes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Admin inbox not found');
    }

    // Get assignments
    const { data: assignments } = await this.supabase
      .from('admin_inbox_assignments')
      .select('inbox_id, inboxes(email, status, health_score)')
      .eq('admin_inbox_id', id);

    return {
      ...data,
      oauth_access_token: undefined,
      oauth_refresh_token: undefined,
      smtp_pass: undefined,
      assignments: assignments ?? [],
    };
  }

  async createAdminInbox(input: {
    email: string;
    provider: 'google' | 'microsoft' | 'smtp';
    max_capacity?: number;
    from_name?: string;
    smtp_host?: string;
    smtp_port?: number;
    smtp_secure?: boolean;
    smtp_user?: string;
    smtp_pass?: string;
  }) {
    const insertData: any = {
      email: input.email,
      provider: input.provider,
      max_capacity: input.max_capacity ?? 20,
      from_name: input.from_name,
    };

    if (input.provider === 'smtp') {
      insertData.smtp_host = input.smtp_host;
      insertData.smtp_port = input.smtp_port ?? 587;
      insertData.smtp_secure = input.smtp_secure ?? false;
      insertData.smtp_user = input.smtp_user;
      if (input.smtp_pass) {
        insertData.smtp_pass = encrypt(input.smtp_pass, this.encryptionKey);
      }
    }

    const { data, error } = await this.supabase
      .from('admin_inboxes')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return { ...data, oauth_access_token: undefined, oauth_refresh_token: undefined, smtp_pass: undefined };
  }

  async createOAuthAdminInbox(
    email: string,
    provider: 'google' | 'microsoft',
    accessToken: string,
    refreshToken: string,
    expiresAt?: Date,
  ) {
    const encryptedAccessToken = encrypt(accessToken, this.encryptionKey);
    const encryptedRefreshToken = encrypt(refreshToken, this.encryptionKey);

    const { data, error } = await this.supabase
      .from('admin_inboxes')
      .insert({
        email,
        provider,
        oauth_access_token: encryptedAccessToken,
        oauth_refresh_token: encryptedRefreshToken,
        oauth_expires_at: expiresAt?.toISOString(),
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return { ...data, oauth_access_token: undefined, oauth_refresh_token: undefined };
  }

  async updateAdminInbox(id: string, input: {
    max_capacity?: number;
    status?: 'active' | 'disabled';
    from_name?: string;
  }) {
    // Verify exists
    await this.getAdminInbox(id);

    const updateData: Record<string, any> = {};
    if (input.max_capacity !== undefined) updateData.max_capacity = input.max_capacity;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.from_name !== undefined) updateData.from_name = input.from_name;

    const { data, error } = await this.supabase
      .from('admin_inboxes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { ...data, oauth_access_token: undefined, oauth_refresh_token: undefined, smtp_pass: undefined };
  }

  async deleteAdminInbox(id: string) {
    await this.getAdminInbox(id);

    // Assignments cascade on delete due to FK constraint
    const { error } = await this.supabase
      .from('admin_inboxes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }

  async checkConnection(id: string): Promise<{ connected: boolean; error?: string }> {
    const { data: inbox, error: fetchError } = await this.supabase
      .from('admin_inboxes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !inbox) {
      throw new NotFoundException('Admin inbox not found');
    }

    try {
      if (inbox.provider === 'smtp') {
        if (!inbox.smtp_host) return { connected: false, error: 'No SMTP host configured' };
        const result = await testSmtpConnection({
          host: inbox.smtp_host,
          port: inbox.smtp_port ?? 587,
          secure: inbox.smtp_secure ?? false,
          username: inbox.smtp_user ?? '',
          password: inbox.smtp_pass ? decrypt(inbox.smtp_pass, this.encryptionKey) : '',
        });
        if (!result.success) {
          await this.markAdminInboxError(id, 'SMTP connection failed');
          return { connected: false, error: result.error ?? 'SMTP connection failed' };
        }
      } else {
        if (!inbox.oauth_access_token || !inbox.oauth_refresh_token) {
          await this.markAdminInboxError(id, 'Missing OAuth credentials');
          return { connected: false, error: 'Missing credentials' };
        }

        let accessToken: string;
        let refreshToken: string;
        try {
          accessToken = decrypt(inbox.oauth_access_token, this.encryptionKey);
          refreshToken = decrypt(inbox.oauth_refresh_token, this.encryptionKey);
        } catch {
          await this.markAdminInboxError(id, 'Failed to decrypt credentials');
          return { connected: false, error: 'Failed to decrypt credentials' };
        }

        if (inbox.provider === 'google') {
          const gmailClient = new GmailClient(
            { accessToken, refreshToken },
            this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '',
            this.configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
          );
          await gmailClient.getProfile();

          const refreshed = await gmailClient.getRefreshedCredentials();
          if (refreshed) {
            await this.supabase
              .from('admin_inboxes')
              .update({
                oauth_access_token: encrypt(refreshed.accessToken, this.encryptionKey),
                oauth_refresh_token: encrypt(refreshed.refreshToken, this.encryptionKey),
                oauth_expires_at: refreshed.expiresAt?.toISOString() ?? null,
              })
              .eq('id', id);
          }
        } else if (inbox.provider === 'microsoft') {
          const expiresAt = inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined;
          const msClient = new MicrosoftClient(
            { accessToken, refreshToken, expiresAt },
            {
              clientId: this.configService.get<string>('MICROSOFT_CLIENT_ID') ?? '',
              clientSecret: this.configService.get<string>('MICROSOFT_CLIENT_SECRET') ?? '',
              onTokenRefresh: async (newCreds) => {
                await this.supabase
                  .from('admin_inboxes')
                  .update({
                    oauth_access_token: encrypt(newCreds.accessToken, this.encryptionKey),
                    oauth_refresh_token: encrypt(newCreds.refreshToken, this.encryptionKey),
                    oauth_expires_at: newCreds.expiresAt?.toISOString() ?? null,
                  })
                  .eq('id', id);
              },
            },
          );
          await msClient.ensureValidToken();
          await msClient.getProfile();
        }
      }

      // Update connection check timestamp and result, auto-recover if previously in error
      const updateData: Record<string, any> = {
        connection_checked_at: new Date().toISOString(),
        connection_check_result: 'success',
      };

      if (inbox.status === 'error') {
        updateData.status = 'active';
        updateData.status_reason = null;
      }

      await this.supabase
        .from('admin_inboxes')
        .update(updateData)
        .eq('id', id);

      return { connected: true };
    } catch (err: any) {
      this.logger.warn(`Admin inbox connection check failed for ${inbox.email}: ${err.message}`);
      await this.markAdminInboxError(id, err.message);
      return { connected: false, error: err.message };
    }
  }

  private async markAdminInboxError(id: string, reason: string): Promise<void> {
    await this.supabase
      .from('admin_inboxes')
      .update({
        status: 'error',
        status_reason: reason,
        connection_checked_at: new Date().toISOString(),
        connection_check_result: reason,
      })
      .eq('id', id);
  }

  // ============================================
  // Assignment Management
  // ============================================

  async getAssignments(adminInboxId: string) {
    // Verify admin inbox exists
    await this.getAdminInbox(adminInboxId);

    const { data, error } = await this.supabase
      .from('admin_inbox_assignments')
      .select(`
        id,
        inbox_id,
        admin_inbox_id,
        assigned_at,
        inbox:inboxes(
          id,
          email,
          provider,
          status,
          health_score,
          team_id
        )
      `)
      .eq('admin_inbox_id', adminInboxId)
      .order('assigned_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch assignments for admin inbox ${adminInboxId}:`, error.message);
      throw error;
    }

    return (data ?? []).map((a: any) => ({
      id: a.id,
      inbox_id: a.inbox_id,
      admin_inbox_id: a.admin_inbox_id,
      assigned_at: a.assigned_at,
      inbox_email: a.inbox?.email,
      inbox_provider: a.inbox?.provider,
      inbox_status: a.inbox?.status,
      inbox_health_score: a.inbox?.health_score,
      team_id: a.inbox?.team_id,
    }));
  }

  async createAssignment(adminInboxId: string, userInboxId: string) {
    // Verify admin inbox exists
    await this.getAdminInbox(adminInboxId);

    // Verify user inbox exists
    const { data: userInbox, error: inboxError } = await this.supabase
      .from('inboxes')
      .select('id, email')
      .eq('id', userInboxId)
      .single();

    if (inboxError || !userInbox) {
      throw new NotFoundException('User inbox not found');
    }

    // Check if assignment already exists
    const { data: existing } = await this.supabase
      .from('admin_inbox_assignments')
      .select('id')
      .eq('admin_inbox_id', adminInboxId)
      .eq('inbox_id', userInboxId)
      .single();

    if (existing) {
      throw new BadRequestException('Assignment already exists');
    }

    // Create assignment
    const { data, error } = await this.supabase
      .from('admin_inbox_assignments')
      .insert({
        admin_inbox_id: adminInboxId,
        inbox_id: userInboxId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create assignment:`, error.message);
      throw error;
    }

    // Update admin inbox current_load
    await this.supabase.rpc('increment_admin_inbox_load', { inbox_id: adminInboxId });

    return {
      ...data,
      inbox_email: userInbox.email,
    };
  }

  async deleteAssignment(adminInboxId: string, assignmentId: string) {
    // Verify admin inbox exists
    await this.getAdminInbox(adminInboxId);

    // Verify assignment exists and belongs to this admin inbox
    const { data: assignment, error: fetchError } = await this.supabase
      .from('admin_inbox_assignments')
      .select('id, admin_inbox_id')
      .eq('id', assignmentId)
      .single();

    if (fetchError || !assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.admin_inbox_id !== adminInboxId) {
      throw new BadRequestException('Assignment does not belong to this admin inbox');
    }

    // Delete assignment
    const { error } = await this.supabase
      .from('admin_inbox_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      this.logger.error(`Failed to delete assignment:`, error.message);
      throw error;
    }

    // Update admin inbox current_load
    await this.supabase.rpc('decrement_admin_inbox_load', { inbox_id: adminInboxId });

    return { success: true };
  }

  async deleteAssignmentByInboxId(adminInboxId: string, userInboxId: string) {
    // Verify admin inbox exists
    await this.getAdminInbox(adminInboxId);

    // Find and delete assignment by user inbox id
    const { data: assignment, error: fetchError } = await this.supabase
      .from('admin_inbox_assignments')
      .select('id')
      .eq('admin_inbox_id', adminInboxId)
      .eq('inbox_id', userInboxId)
      .single();

    if (fetchError || !assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Delete assignment
    const { error } = await this.supabase
      .from('admin_inbox_assignments')
      .delete()
      .eq('id', assignment.id);

    if (error) {
      this.logger.error(`Failed to delete assignment:`, error.message);
      throw error;
    }

    // Update admin inbox current_load
    await this.supabase.rpc('decrement_admin_inbox_load', { inbox_id: adminInboxId });

    return { success: true };
  }

  // ============================================
  // Stats & History
  // ============================================

  async getStats(adminInboxId: string) {
    // Verify admin inbox exists
    const inbox = await this.getAdminInbox(adminInboxId);

    // Get interaction history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: interactions, error: interactionError } = await this.supabase
      .from('admin_warmup_interactions')
      .select('id, direction, interaction_type, created_at')
      .eq('admin_inbox_id', adminInboxId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (interactionError) {
      this.logger.warn(`Failed to fetch interactions for admin inbox ${adminInboxId}:`, interactionError.message);
    }

    // Aggregate daily stats
    const dailyStats: Record<string, { sent: number; received: number; replied: number }> = {};

    for (const i of interactions ?? []) {
      const date = new Date(i.created_at).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { sent: 0, received: 0, replied: 0 };
      }

      if (i.interaction_type === 'sent') {
        dailyStats[date].sent++;
      } else if (i.interaction_type === 'received') {
        dailyStats[date].received++;
      } else if (i.interaction_type === 'replied') {
        dailyStats[date].replied++;
      }
    }

    // Convert to array sorted by date
    const history = Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get assignment count
    const { count: assignmentCount } = await this.supabase
      .from('admin_inbox_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('admin_inbox_id', adminInboxId);

    return {
      inbox: {
        id: inbox.id,
        email: inbox.email,
        provider: inbox.provider,
        status: inbox.status,
        health_score: inbox.health_score,
        max_capacity: inbox.max_capacity,
        current_load: inbox.current_load,
      },
      totals: {
        sent: inbox.sent_total,
        received: inbox.received_total,
        assignments: assignmentCount ?? 0,
      },
      today: {
        sent: inbox.sent_today,
        received: inbox.received_today,
      },
      history,
    };
  }
}
