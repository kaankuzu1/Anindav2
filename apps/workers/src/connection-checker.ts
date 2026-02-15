import type { SupabaseClient } from '@supabase/supabase-js';
import { GmailClient, MicrosoftClient, testSmtpConnection } from '@aninda/email-client';
import { decrypt, encrypt } from '@aninda/shared';

export class ConnectionChecker {
  private timeoutId: NodeJS.Timeout | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private encryptionKey: string;

  constructor(
    private readonly supabase: SupabaseClient,
  ) {
    this.encryptionKey = process.env.ENCRYPTION_KEY!;
  }

  start() {
    const msUntilNextCheck = this.msUntilNextRun();
    const nextRunDate = new Date(Date.now() + msUntilNextCheck);
    console.log(`Connection checker started, next check at ${nextRunDate.toISOString()}`);

    this.timeoutId = setTimeout(() => {
      this.runAllChecks();
      // Then repeat every 24 hours
      this.intervalId = setInterval(() => this.runAllChecks(), 24 * 60 * 60 * 1000);
    }, msUntilNextCheck);
  }

  stop() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private msUntilNextRun(): number {
    const now = new Date();
    const target = new Date(now);
    target.setUTCHours(4, 0, 0, 0); // 04:00 UTC

    if (target.getTime() <= now.getTime()) {
      // Already past 04:00 today, schedule for tomorrow
      target.setUTCDate(target.getUTCDate() + 1);
    }

    return target.getTime() - now.getTime();
  }

  private async runAllChecks() {
    await this.checkAllInboxes();
    await this.checkAdminInboxes();
  }

  async checkAllInboxes() {
    console.log('Connection checker: starting daily check...');

    const { data: inboxes, error } = await this.supabase
      .from('inboxes')
      .select('*')
      .in('status', ['active', 'warming_up']);

    if (error || !inboxes) {
      console.error('Connection checker: failed to fetch inboxes:', error?.message);
      return;
    }

    let checked = 0;
    let disconnected = 0;

    for (const inbox of inboxes) {
      try {
        const isConnected = await this.validateConnection(inbox);
        if (!isConnected) {
          await this.markDisconnected(inbox.id);
          disconnected++;
        } else {
          // Persist refreshed tokens handled inside validateConnection
        }
      } catch (err: any) {
        console.warn(`Connection checker: error checking ${inbox.email}: ${err.message}`);
      }
      checked++;
    }

    console.log(`Connection check complete: ${checked} checked, ${disconnected} disconnected`);
  }

  async checkAdminInboxes() {
    console.log('Connection checker: checking admin inboxes...');

    const { data: adminInboxes, error } = await this.supabase
      .from('admin_inboxes')
      .select('*')
      .eq('status', 'active');

    if (error || !adminInboxes) {
      console.error('Connection checker: failed to fetch admin inboxes:', error?.message);
      return;
    }

    let checked = 0;
    let disconnected = 0;

    for (const inbox of adminInboxes) {
      try {
        const isConnected = await this.validateConnection(inbox);
        if (!isConnected) {
          await this.markAdminDisconnected(inbox.id);
          disconnected++;
        }
      } catch (err: any) {
        console.warn(`Connection checker: error checking admin inbox ${inbox.email}: ${err.message}`);
      }
      checked++;
    }

    console.log(`Admin inbox check complete: ${checked} checked, ${disconnected} disconnected`);
  }

  private async validateConnection(inbox: any): Promise<boolean> {
    const isAdmin = !inbox.team_id; // admin_inboxes don't have team_id

    // SMTP inbox
    if (inbox.provider === 'smtp') {
      if (!inbox.smtp_host) return false;
      const result = await testSmtpConnection({
        host: inbox.smtp_host,
        port: inbox.smtp_port ?? 587,
        secure: inbox.smtp_secure ?? false,
        username: inbox.smtp_user ?? '',
        password: inbox.smtp_pass ? decrypt(inbox.smtp_pass, this.encryptionKey) : '',
      });
      return result.success;
    }

    // OAuth inboxes
    if (!inbox.oauth_access_token || !inbox.oauth_refresh_token) {
      return false;
    }

    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = decrypt(inbox.oauth_access_token, this.encryptionKey);
      refreshToken = decrypt(inbox.oauth_refresh_token, this.encryptionKey);
    } catch {
      return false;
    }

    const table = isAdmin ? 'admin_inboxes' : 'inboxes';

    if (inbox.provider === 'google') {
      const gmailClient = new GmailClient(
        { accessToken, refreshToken },
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
      );
      await gmailClient.getProfile();

      // Persist refreshed tokens
      const refreshed = await gmailClient.getRefreshedCredentials();
      if (refreshed) {
        const encAccessToken = encrypt(refreshed.accessToken, this.encryptionKey);
        const encRefreshToken = encrypt(refreshed.refreshToken, this.encryptionKey);
        await this.supabase
          .from(table)
          .update({
            oauth_access_token: encAccessToken,
            oauth_refresh_token: encRefreshToken,
            oauth_expires_at: refreshed.expiresAt?.toISOString() ?? null,
          })
          .eq('id', inbox.id);
      }
      return true;
    }

    if (inbox.provider === 'microsoft') {
      const expiresAt = inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined;
      const msClient = new MicrosoftClient(
        { accessToken, refreshToken, expiresAt },
        {
          clientId: process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
          onTokenRefresh: async (newCreds) => {
            const encAccessToken = encrypt(newCreds.accessToken, this.encryptionKey);
            const encRefreshToken = encrypt(newCreds.refreshToken, this.encryptionKey);
            await this.supabase
              .from(table)
              .update({
                oauth_access_token: encAccessToken,
                oauth_refresh_token: encRefreshToken,
                oauth_expires_at: newCreds.expiresAt?.toISOString() ?? null,
              })
              .eq('id', inbox.id);
          },
        },
      );
      await msClient.ensureValidToken();
      await msClient.getProfile();
      return true;
    }

    return false;
  }

  private async markDisconnected(inboxId: string): Promise<void> {
    await this.supabase
      .from('inboxes')
      .update({
        status: 'error',
        status_reason: 'Email account disconnected — please reconnect',
      })
      .eq('id', inboxId);

    await this.supabase
      .from('warmup_state')
      .update({
        enabled: false,
        phase: 'paused',
      })
      .eq('inbox_id', inboxId);

    // Cascade: check pool warmup for the team
    const { data: inbox } = await this.supabase
      .from('inboxes')
      .select('team_id')
      .eq('id', inboxId)
      .single();

    if (inbox) {
      await this.cascadePoolWarmupCheck(inbox.team_id);
    }

    try {
      await this.supabase
        .from('inbox_events')
        .insert({
          inbox_id: inboxId,
          event_type: 'disconnected',
        });
    } catch {
      // inbox_events table may not exist — non-critical
    }
  }

  private async markAdminDisconnected(adminInboxId: string): Promise<void> {
    await this.supabase
      .from('admin_inboxes')
      .update({
        status: 'error',
        status_reason: 'Email account disconnected — please reconnect',
      })
      .eq('id', adminInboxId);

    // Find all assigned user inboxes and disable their network warmup
    const { data: assignments } = await this.supabase
      .from('admin_inbox_assignments')
      .select('inbox_id')
      .eq('admin_inbox_id', adminInboxId);

    for (const assignment of assignments ?? []) {
      await this.supabase
        .from('warmup_state')
        .update({ enabled: false, phase: 'paused' })
        .eq('inbox_id', assignment.inbox_id)
        .eq('warmup_mode', 'network');

      // Reset inbox status from 'warming_up' to 'active'
      await this.supabase
        .from('inboxes')
        .update({ status: 'active' })
        .eq('id', assignment.inbox_id)
        .eq('status', 'warming_up');

      console.log(`Disabled network warmup for user inbox ${assignment.inbox_id} (admin inbox disconnected)`);
    }

    // Delete assignments and reset load
    await this.supabase
      .from('admin_inbox_assignments')
      .delete()
      .eq('admin_inbox_id', adminInboxId);

    await this.supabase
      .from('admin_inboxes')
      .update({ current_load: 0 })
      .eq('id', adminInboxId);
  }

  /**
   * After disconnecting a user inbox, check remaining pool warmup inboxes for the team.
   * If fewer than 2 connected pool inboxes remain, disable all pool warmups.
   */
  private async cascadePoolWarmupCheck(teamId: string): Promise<void> {
    const { data: poolStates } = await this.supabase
      .from('warmup_state')
      .select('inbox_id, warmup_mode, inbox:inboxes(id, status, team_id)')
      .eq('enabled', true);

    const connectedPoolInboxes = (poolStates ?? []).filter((ws: any) => {
      const wsInbox = ws.inbox as any;
      return wsInbox?.team_id === teamId &&
        ws.warmup_mode !== 'network' &&
        (wsInbox.status === 'active' || wsInbox.status === 'warming_up');
    });

    if (connectedPoolInboxes.length < 2) {
      for (const ws of connectedPoolInboxes) {
        await this.supabase
          .from('warmup_state')
          .update({ enabled: false, phase: 'paused' })
          .eq('inbox_id', ws.inbox_id);

        // Reset inbox status from 'warming_up' back to 'active'
        await this.supabase
          .from('inboxes')
          .update({ status: 'active' })
          .eq('id', ws.inbox_id)
          .eq('status', 'warming_up');

        console.log(`Cascade: Disabled pool warmup for ${ws.inbox_id} (insufficient pool peers after disconnection)`);
      }
    }
  }
}
