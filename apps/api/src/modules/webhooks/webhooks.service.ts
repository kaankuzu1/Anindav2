import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { generateWebhookSignature, type CreateWebhook } from '@aninda/shared';
import crypto from 'crypto';

export interface WebhookTestResult {
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async getWebhooks(teamId: string) {
    const { data, error } = await this.supabase
      .from('webhooks')
      .select('id, team_id, url, events, is_active, created_at, updated_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getWebhook(webhookId: string, teamId: string) {
    const { data, error } = await this.supabase
      .from('webhooks')
      .select('id, team_id, url, events, is_active, created_at, updated_at')
      .eq('id', webhookId)
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Webhook not found');
    }

    return data;
  }

  async createWebhook(teamId: string, dto: CreateWebhook) {
    // Generate a secret if not provided
    const secret = dto.secret ?? crypto.randomBytes(32).toString('hex');

    const { data, error } = await this.supabase
      .from('webhooks')
      .insert({
        team_id: teamId,
        url: dto.url,
        events: dto.events,
        secret,
        is_active: true,
      })
      .select('id, team_id, url, events, secret, is_active, created_at')
      .single();

    if (error) throw error;
    return data;
  }

  async updateWebhook(
    webhookId: string,
    teamId: string,
    dto: Partial<{
      url: string;
      events: string[];
      is_active: boolean;
    }>,
  ) {
    // Verify webhook belongs to team
    await this.getWebhook(webhookId, teamId);

    const { data, error } = await this.supabase
      .from('webhooks')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .select('id, team_id, url, events, is_active, created_at, updated_at')
      .single();

    if (error) throw error;
    return data;
  }

  async deleteWebhook(webhookId: string, teamId: string) {
    // Verify webhook belongs to team
    await this.getWebhook(webhookId, teamId);

    const { error } = await this.supabase
      .from('webhooks')
      .delete()
      .eq('id', webhookId);

    if (error) throw error;
    return { success: true };
  }

  async rotateSecret(webhookId: string, teamId: string) {
    // Verify webhook belongs to team
    await this.getWebhook(webhookId, teamId);

    const newSecret = crypto.randomBytes(32).toString('hex');

    const { data, error } = await this.supabase
      .from('webhooks')
      .update({
        secret: newSecret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .select('id, secret')
      .single();

    if (error) throw error;
    return { secret: data.secret };
  }

  async testWebhook(webhookId: string, teamId: string): Promise<WebhookTestResult> {
    // Get webhook with secret
    const { data: webhook, error } = await this.supabase
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .eq('team_id', teamId)
      .single();

    if (error || !webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Build test payload
    const body = JSON.stringify({
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhook_id: webhookId,
      },
    });

    // Sign the payload
    const signature = generateWebhookSignature(body, webhook.secret);

    // Deliver the test webhook
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'webhook.test',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Timestamp': new Date().toISOString(),
          'X-Webhook-Id': webhookId,
          'User-Agent': 'Aninda-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (err: any) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: err.name === 'AbortError' ? 'Request timed out' : err.message,
      };
    }
  }

  async getDeliveryLogs(webhookId: string, teamId: string, limit = 50) {
    // Verify webhook belongs to team
    await this.getWebhook(webhookId, teamId);

    const { data, error } = await this.supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
}
