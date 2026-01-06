import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';

@Controller('ai')
@UseGuards(SupabaseAuthGuard)
export class AIController {
  constructor(private readonly aiService: AIService) {}

  // ============================================
  // AI Reply Assistant
  // ============================================

  @Post('generate-reply')
  async generateReply(
    @Body() body: {
      threadContext: string;
      originalEmail: string;
      tone?: 'professional' | 'friendly' | 'short' | 'follow_up';
      senderName?: string;
    },
  ) {
    return this.aiService.generateReply(
      body.threadContext,
      body.originalEmail,
      body.tone || 'professional',
      body.senderName,
    );
  }

  // ============================================
  // AI Intent Detection
  // ============================================

  @Post('detect-intent')
  async detectIntent(
    @Body() body: {
      emailContent: string;
      subject: string;
    },
  ) {
    return this.aiService.detectIntent(body.emailContent, body.subject);
  }

  // ============================================
  // AI Campaign Copy Generator
  // ============================================

  @Post('generate-campaign')
  async generateCampaignCopy(
    @Body() body: {
      productDescription: string;
      targetAudience: string;
      tone: 'professional' | 'casual' | 'friendly' | 'urgent';
      senderName?: string;
      companyName?: string;
    },
  ) {
    return this.aiService.generateCampaignCopy(body);
  }

  // ============================================
  // AI Spam Risk Checker
  // ============================================

  @Post('check-spam')
  async checkSpamRisk(
    @Body() body: {
      emailContent: string;
      subject: string;
    },
  ) {
    return this.aiService.checkSpamRisk(body.emailContent, body.subject);
  }

  // ============================================
  // AI Follow-Up Generator
  // ============================================

  @Post('generate-followup')
  async generateFollowUp(
    @Body() body: {
      originalEmail: string;
      previousFollowUps?: string[];
      daysSinceLastEmail?: number;
    },
  ) {
    return this.aiService.generateFollowUp(
      body.originalEmail,
      body.previousFollowUps || [],
      body.daysSinceLastEmail || 3,
    );
  }

  // ============================================
  // AI Daily Summary
  // ============================================

  @Get('daily-summary')
  async getDailySummary(@Query('team_id') teamId: string) {
    return this.aiService.generateDailySummary(teamId);
  }

  // ============================================
  // AI Objection Handling
  // ============================================

  @Post('handle-objection')
  async handleObjection(
    @Body() body: {
      objectionEmail: string;
      objectionType?: string;
    },
  ) {
    return this.aiService.handleObjection(body.objectionEmail, body.objectionType);
  }

  // ============================================
  // Batch Intent Detection
  // ============================================

  @Post('batch-detect-intent')
  async batchDetectIntent(
    @Body() body: {
      emails: Array<{ id: string; subject: string; body: string }>;
    },
  ) {
    return this.aiService.batchDetectIntent(body.emails);
  }
}
