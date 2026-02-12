import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';
import { WebhooksService } from './webhooks.service';
import { createWebhookSchema, type CreateWebhook } from '@aninda/shared';

@Controller('webhooks')
@UseGuards(SupabaseAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Get all webhooks for a team
   * GET /api/v1/webhooks?team_id=...
   */
  @Get()
  async getWebhooks(@Query('team_id') teamId: string) {
    return this.webhooksService.getWebhooks(teamId);
  }

  /**
   * Get a specific webhook
   * GET /api/v1/webhooks/:id?team_id=...
   */
  @Get(':id')
  async getWebhook(
    @Param('id') webhookId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.webhooksService.getWebhook(webhookId, teamId);
  }

  /**
   * Create a new webhook
   * POST /api/v1/webhooks?team_id=...
   */
  @Post()
  async createWebhook(
    @Query('team_id') teamId: string,
    @Body() body: CreateWebhook,
  ) {
    // Validate with Zod
    const validated = createWebhookSchema.parse(body);
    return this.webhooksService.createWebhook(teamId, validated);
  }

  /**
   * Update a webhook
   * PATCH /api/v1/webhooks/:id?team_id=...
   */
  @Patch(':id')
  async updateWebhook(
    @Param('id') webhookId: string,
    @Query('team_id') teamId: string,
    @Body() body: Partial<{ url: string; events: string[]; is_active: boolean }>,
  ) {
    return this.webhooksService.updateWebhook(webhookId, teamId, body);
  }

  /**
   * Delete a webhook
   * DELETE /api/v1/webhooks/:id?team_id=...
   */
  @Delete(':id')
  async deleteWebhook(
    @Param('id') webhookId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.webhooksService.deleteWebhook(webhookId, teamId);
  }

  /**
   * Rotate webhook secret
   * POST /api/v1/webhooks/:id/rotate-secret?team_id=...
   */
  @Post(':id/rotate-secret')
  async rotateSecret(
    @Param('id') webhookId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.webhooksService.rotateSecret(webhookId, teamId);
  }

  /**
   * Test webhook delivery
   * POST /api/v1/webhooks/:id/test?team_id=...
   */
  @Post(':id/test')
  async testWebhook(
    @Param('id') webhookId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.webhooksService.testWebhook(webhookId, teamId);
  }

  /**
   * Get webhook delivery logs
   * GET /api/v1/webhooks/:id/logs?team_id=...&limit=50
   */
  @Get(':id/logs')
  async getDeliveryLogs(
    @Param('id') webhookId: string,
    @Query('team_id') teamId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.webhooksService.getDeliveryLogs(webhookId, teamId, parsedLimit);
  }
}
