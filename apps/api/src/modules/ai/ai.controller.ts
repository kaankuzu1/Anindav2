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
  // AI CSV Column Mapping
  // ============================================

  @Post('map-columns')
  async mapCsvColumns(
    @Body() body: {
      headers: string[];
      sampleRows: string[][];
    },
  ) {
    return this.aiService.mapCsvColumns(body.headers, body.sampleRows);
  }

  // ============================================
  // AI Smart Template Personalization
  // ============================================

  @Post('personalize-email')
  async personalizeEmail(
    @Body() body: {
      subject: string;
      body: string;
      lead: { firstName?: string; lastName?: string; company?: string; title?: string; analysisNotes?: string; country?: string; city?: string; linkedinUrl?: string; website?: string };
      tone?: string;
      country?: string;
      creatorNotes?: string;
      toneEnabled?: boolean;
      languageMatch?: boolean;
      sender?: { firstName?: string; lastName?: string; company?: string; title?: string; website?: string };
    },
  ) {
    // Step 1: Replace [placeholders] with AI-generated content
    let result = await this.aiService.personalizeEmail(
      body.subject,
      body.body,
      body.lead,
      body.tone,
      body.country,
      body.creatorNotes,
      body.toneEnabled ?? false,
      body.languageMatch ?? true,
      body.sender,
    );

    // Step 2: Apply whole-template tone adjustment and/or language translation
    const toneLanguageResult = await this.aiService.applyToneAndLanguage(
      result.subject,
      result.body,
      body.tone || 'professional',
      body.toneEnabled ?? false,
      body.country,
      body.languageMatch ?? true,
      body.creatorNotes,
    );

    if (toneLanguageResult) {
      result = toneLanguageResult;
    }

    return result;
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
