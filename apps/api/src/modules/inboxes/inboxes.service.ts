import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { encrypt, decrypt } from '@aninda/shared';

@Injectable()
export class InboxesService {
  private encryptionKey: string;

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async getInboxes(teamId: string) {
    const { data, error } = await this.supabase
      .from('inboxes')
      .select('*, inbox_settings(*), warmup_state(*)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getInbox(inboxId: string, teamId: string) {
    const { data, error } = await this.supabase
      .from('inboxes')
      .select('*, inbox_settings(*), warmup_state(*)')
      .eq('id', inboxId)
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Inbox not found');
    }

    return data;
  }

  async createOAuthInbox(
    teamId: string,
    email: string,
    provider: 'google' | 'microsoft',
    accessToken: string,
    refreshToken: string,
    expiresAt?: Date,
  ) {
    // Encrypt tokens
    const encryptedAccessToken = encrypt(accessToken, this.encryptionKey);
    const encryptedRefreshToken = encrypt(refreshToken, this.encryptionKey);

    const { data: inbox, error } = await this.supabase
      .from('inboxes')
      .insert({
        team_id: teamId,
        email,
        provider,
        status: 'active',
        oauth_access_token: encryptedAccessToken,
        oauth_refresh_token: encryptedRefreshToken,
        oauth_expires_at: expiresAt?.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Create default settings
    await this.supabase
      .from('inbox_settings')
      .insert({
        inbox_id: inbox.id,
      });

    // Create warmup state
    await this.supabase
      .from('warmup_state')
      .insert({
        inbox_id: inbox.id,
        enabled: false,
      });

    return inbox;
  }

  async updateInboxSettings(
    inboxId: string,
    teamId: string,
    settings: Partial<{
      daily_send_limit: number;
      hourly_limit: number;
      min_delay_seconds: number;
      max_delay_seconds: number;
      send_window_start: string;
      send_window_end: string;
      send_window_timezone: string;
      weekends_enabled: boolean;
    }>,
  ) {
    // Verify inbox belongs to team
    await this.getInbox(inboxId, teamId);

    const { data, error } = await this.supabase
      .from('inbox_settings')
      .update(settings)
      .eq('inbox_id', inboxId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async pauseInbox(inboxId: string, teamId: string) {
    await this.getInbox(inboxId, teamId);

    const { data, error } = await this.supabase
      .from('inboxes')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
      })
      .eq('id', inboxId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async resumeInbox(inboxId: string, teamId: string) {
    await this.getInbox(inboxId, teamId);

    const { data, error } = await this.supabase
      .from('inboxes')
      .update({
        status: 'active',
        paused_at: null,
      })
      .eq('id', inboxId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteInbox(inboxId: string, teamId: string) {
    await this.getInbox(inboxId, teamId);

    const { error } = await this.supabase
      .from('inboxes')
      .delete()
      .eq('id', inboxId);

    if (error) throw error;
    return { success: true };
  }

  async getDecryptedCredentials(inboxId: string, teamId: string) {
    const inbox = await this.getInbox(inboxId, teamId);

    if (!inbox.oauth_access_token || !inbox.oauth_refresh_token) {
      return null;
    }

    return {
      accessToken: decrypt(inbox.oauth_access_token, this.encryptionKey),
      refreshToken: decrypt(inbox.oauth_refresh_token, this.encryptionKey),
      expiresAt: inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined,
    };
  }

  async updateCredentials(
    inboxId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt?: Date,
  ) {
    const encryptedAccessToken = encrypt(accessToken, this.encryptionKey);
    const encryptedRefreshToken = encrypt(refreshToken, this.encryptionKey);

    const { error } = await this.supabase
      .from('inboxes')
      .update({
        oauth_access_token: encryptedAccessToken,
        oauth_refresh_token: encryptedRefreshToken,
        oauth_expires_at: expiresAt?.toISOString(),
      })
      .eq('id', inboxId);

    if (error) throw error;
  }

  async incrementSentCount(inboxId: string) {
    // Use raw SQL for atomic increment
    const { error } = await this.supabase.rpc('increment_inbox_sent', {
      inbox_id: inboxId,
    });

    if (error) {
      // Fallback to regular update
      const { data: inbox } = await this.supabase
        .from('inboxes')
        .select('sent_today, sent_total')
        .eq('id', inboxId)
        .single();

      if (inbox) {
        await this.supabase
          .from('inboxes')
          .update({
            sent_today: (inbox.sent_today ?? 0) + 1,
            sent_total: (inbox.sent_total ?? 0) + 1,
            last_sent_at: new Date().toISOString(),
          })
          .eq('id', inboxId);
      }
    }
  }
}
