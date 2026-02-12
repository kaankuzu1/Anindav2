import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import {
  encrypt,
  decrypt,
  validateDns,
  enforceDnsRequirements,
  type DnsValidationResult,
} from '@aninda/shared';
import { GmailClient, MicrosoftClient, testSmtpConnection } from '@aninda/email-client';

@Injectable()
export class InboxesService {
  private readonly logger = new Logger(InboxesService.name);
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
  ): Promise<{
    inbox: any;
    dns_warnings: string[];
    dns_score: number;
  }> {
    // Encrypt tokens
    const encryptedAccessToken = encrypt(accessToken, this.encryptionKey);
    const encryptedRefreshToken = encrypt(refreshToken, this.encryptionKey);

    // Extract domain from email
    const domain = email.split('@')[1];

    // Validate DNS configuration
    let dnsResult: DnsValidationResult | null = null;
    let dnsWarnings: string[] = [];
    try {
      dnsResult = await validateDns(domain);
      dnsWarnings = dnsResult.recommendations;
    } catch (error) {
      console.warn(`DNS validation failed for ${domain}:`, error);
      dnsWarnings = ['DNS validation failed - please check your DNS configuration'];
    }

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

    // Store/update domain DNS info
    if (dnsResult) {
      await this.upsertDomainDns(teamId, domain, dnsResult);
    }

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

    return {
      inbox,
      dns_warnings: dnsWarnings,
      dns_score: dnsResult?.score ?? 0,
    };
  }

  /**
   * Upsert domain DNS validation results
   */
  private async upsertDomainDns(teamId: string, domain: string, dnsResult: DnsValidationResult): Promise<void> {
    try {
      // Check if domain exists
      const { data: existing } = await this.supabase
        .from('domains')
        .select('id')
        .eq('team_id', teamId)
        .eq('domain', domain)
        .single();

      const domainData = {
        team_id: teamId,
        domain,
        spf_valid: dnsResult.spf.valid,
        spf_record: dnsResult.spf.record,
        dkim_valid: dnsResult.dkim.valid,
        dkim_selector: dnsResult.dkim.selector,
        dkim_record: dnsResult.dkim.record,
        dmarc_valid: dnsResult.dmarc.valid,
        dmarc_policy: dnsResult.dmarc.policy,
        dmarc_record: dnsResult.dmarc.record,
        health_score: dnsResult.score,
        last_checked_at: new Date().toISOString(),
      };

      if (existing) {
        await this.supabase
          .from('domains')
          .update(domainData)
          .eq('id', existing.id);
      } else {
        await this.supabase
          .from('domains')
          .insert(domainData);
      }
    } catch (error) {
      console.warn('Failed to upsert domain DNS info:', error);
    }
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
      // Inbox-level fields (from_name, sender_*)
      from_name: string | null;
      sender_first_name: string | null;
      sender_last_name: string | null;
      sender_company: string | null;
      sender_title: string | null;
      sender_phone: string | null;
      sender_website: string | null;
    }>,
  ) {
    // Verify inbox belongs to team
    await this.getInbox(inboxId, teamId);

    // Separate inbox-level fields from inbox_settings fields
    const {
      from_name,
      sender_first_name,
      sender_last_name,
      sender_company,
      sender_title,
      sender_phone,
      sender_website,
      ...inboxSettings
    } = settings;

    // Update inbox-level fields if any provided
    const inboxUpdate: Record<string, any> = {};
    if (from_name !== undefined) inboxUpdate.from_name = from_name;
    if (sender_first_name !== undefined) inboxUpdate.sender_first_name = sender_first_name;
    if (sender_last_name !== undefined) inboxUpdate.sender_last_name = sender_last_name;
    if (sender_company !== undefined) inboxUpdate.sender_company = sender_company;
    if (sender_title !== undefined) inboxUpdate.sender_title = sender_title;
    if (sender_phone !== undefined) inboxUpdate.sender_phone = sender_phone;
    if (sender_website !== undefined) inboxUpdate.sender_website = sender_website;

    if (Object.keys(inboxUpdate).length > 0) {
      const { error: inboxError } = await this.supabase
        .from('inboxes')
        .update(inboxUpdate)
        .eq('id', inboxId);

      if (inboxError) throw inboxError;
    }

    // Update inbox_settings if any provided
    if (Object.keys(inboxSettings).length > 0) {
      const { data, error } = await this.supabase
        .from('inbox_settings')
        .update(inboxSettings)
        .eq('inbox_id', inboxId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    return this.getInbox(inboxId, teamId);
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

  async resumeInbox(inboxId: string, teamId: string): Promise<{
    inbox: any;
    dns_warnings: string[];
  }> {
    const inbox = await this.getInbox(inboxId, teamId);
    const domain = inbox.email.split('@')[1];

    // Check DNS requirements before resuming
    let dnsWarnings: string[] = [];
    try {
      const dnsCheck = await enforceDnsRequirements(domain, {
        requireSpf: true,
        requireDkim: false,
        requireDmarc: false,
        minScore: 35,
      });

      if (!dnsCheck.passed) {
        dnsWarnings = dnsCheck.failures;
      }

      // Update domain DNS info
      await this.upsertDomainDns(teamId, domain, dnsCheck.result);
    } catch (error) {
      console.warn(`DNS check failed for ${domain}:`, error);
      dnsWarnings = ['DNS check failed - deliverability may be affected'];
    }

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

    return {
      inbox: data,
      dns_warnings: dnsWarnings,
    };
  }

  /**
   * Check DNS configuration for an inbox
   * Returns full DNS validation results
   */
  async checkInboxDns(inboxId: string, teamId: string): Promise<{
    domain: string;
    validation: DnsValidationResult;
    requirements_met: boolean;
    failures: string[];
  }> {
    const inbox = await this.getInbox(inboxId, teamId);
    const domain = inbox.email.split('@')[1];

    // Full DNS validation
    const validation = await validateDns(domain);

    // Check against requirements
    const requirements = await enforceDnsRequirements(domain, {
      requireSpf: true,
      requireDkim: false,
      requireDmarc: false,
      minScore: 35,
    });

    // Update domain DNS info
    await this.upsertDomainDns(teamId, domain, validation);

    return {
      domain,
      validation,
      requirements_met: requirements.passed,
      failures: requirements.failures,
    };
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

  async checkConnection(inboxId: string, teamId: string): Promise<{ connected: boolean; error?: string }> {
    const inbox = await this.getInbox(inboxId, teamId);

    // Decrypt credentials
    let accessToken: string;
    let refreshToken: string;
    try {
      if (!inbox.oauth_access_token || !inbox.oauth_refresh_token) {
        // SMTP inbox — check SMTP credentials
        if (inbox.provider === 'smtp' && inbox.smtp_host) {
          const result = await testSmtpConnection({
            host: inbox.smtp_host,
            port: inbox.smtp_port ?? 587,
            secure: inbox.smtp_secure ?? false,
            username: inbox.smtp_user ?? '',
            password: inbox.smtp_pass ? decrypt(inbox.smtp_pass, this.encryptionKey) : '',
          });
          if (!result.success) {
            await this.markDisconnected(inboxId);
            return { connected: false, error: result.error ?? 'SMTP connection failed' };
          }
          // Auto-recover if previously disconnected
          await this.autoRecover(inbox);
          return { connected: true };
        }
        await this.markDisconnected(inboxId);
        return { connected: false, error: 'Missing credentials' };
      }
      accessToken = decrypt(inbox.oauth_access_token, this.encryptionKey);
      refreshToken = decrypt(inbox.oauth_refresh_token, this.encryptionKey);
    } catch (err) {
      this.logger.warn(`Failed to decrypt credentials for inbox ${inboxId}: ${err}`);
      await this.markDisconnected(inboxId);
      return { connected: false, error: 'Failed to decrypt credentials — please reconnect' };
    }

    try {
      if (inbox.provider === 'google') {
        const gmailClient = new GmailClient(
          { accessToken, refreshToken },
          this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '',
          this.configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
        );
        await gmailClient.getProfile();

        // Persist any refreshed tokens
        const refreshed = await gmailClient.getRefreshedCredentials();
        if (refreshed) {
          await this.updateCredentials(
            inboxId,
            refreshed.accessToken,
            refreshed.refreshToken,
            refreshed.expiresAt,
          );
        }
      } else if (inbox.provider === 'microsoft') {
        const expiresAt = inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined;
        const msClient = new MicrosoftClient(
          { accessToken, refreshToken, expiresAt },
          {
            clientId: this.configService.get<string>('MICROSOFT_CLIENT_ID') ?? '',
            clientSecret: this.configService.get<string>('MICROSOFT_CLIENT_SECRET') ?? '',
            onTokenRefresh: async (newCreds) => {
              await this.updateCredentials(
                inboxId,
                newCreds.accessToken,
                newCreds.refreshToken,
                newCreds.expiresAt,
              );
            },
          },
        );
        await msClient.ensureValidToken();
        await msClient.getProfile();
      }
    } catch (err: any) {
      this.logger.warn(`Connection check failed for inbox ${inbox.email}: ${err.message}`);
      await this.markDisconnected(inboxId);
      return { connected: false, error: err.message };
    }

    // Auto-recover if previously disconnected
    await this.autoRecover(inbox);
    return { connected: true };
  }

  async markDisconnected(inboxId: string): Promise<void> {
    // Set inbox status to error
    await this.supabase
      .from('inboxes')
      .update({
        status: 'error',
        status_reason: 'Email account disconnected — please reconnect',
      })
      .eq('id', inboxId);

    // Disable warmup
    await this.supabase
      .from('warmup_state')
      .update({
        enabled: false,
        phase: 'paused',
      })
      .eq('inbox_id', inboxId);

    // Log event
    try {
      await this.supabase
        .from('inbox_events')
        .insert({
          inbox_id: inboxId,
          event_type: 'disconnected',
        });
    } catch (err) {
      // inbox_events table may not exist — non-critical
      this.logger.warn(`Failed to log disconnected event for inbox ${inboxId}`);
    }
  }

  private async autoRecover(inbox: any): Promise<void> {
    if (
      inbox.status === 'error' &&
      inbox.status_reason?.includes('disconnected')
    ) {
      await this.supabase
        .from('inboxes')
        .update({
          status: 'active',
          status_reason: null,
        })
        .eq('id', inbox.id);

      this.logger.log(`Inbox ${inbox.email} auto-recovered from disconnected state`);
    }
  }
}
