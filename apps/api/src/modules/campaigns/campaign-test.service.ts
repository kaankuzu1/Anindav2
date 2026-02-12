import { Injectable, Inject, Logger, BadRequestException, InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { AIService } from '../ai/ai.service';
import { processEmailContent, getLanguageFromCountry, decrypt } from '@aninda/shared';
import { GmailClient, MicrosoftClient } from '@aninda/email-client';

interface TestEmailInput {
  subject: string;
  body: string;
  smartTemplateEnabled: boolean;
  smartTemplateTone?: string;
  smartTemplateLanguageMatch?: boolean;
  smartTemplateNotes?: string;
  smartTemplateToneEnabled?: boolean;
  testLead: {
    first_name?: string;
    last_name?: string;
    company?: string;
    title?: string;
    analysis_notes?: string;
    country?: string;
    linkedin_url?: string;
    website?: string;
    city?: string;
  };
  inboxId: string;
  teamId: string;
  recipientEmail?: string;
}

@Injectable()
export class CampaignTestService {
  private readonly logger = new Logger(CampaignTestService.name);
  private readonly encryptionKey: string;
  private readonly googleClientId: string;
  private readonly googleClientSecret: string;
  private readonly microsoftClientId: string;
  private readonly microsoftClientSecret: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    private readonly aiService: AIService,
  ) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || '';
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    this.googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    this.microsoftClientId = this.configService.get<string>('MICROSOFT_CLIENT_ID') || '';
    this.microsoftClientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET') || '';
  }

  async previewTest(input: TestEmailInput): Promise<{ subject: string; body: string }> {
    // 1. Fetch inbox and verify team ownership
    const { data: inbox, error: inboxError } = await this.supabase
      .from('inboxes')
      .select('*')
      .eq('id', input.inboxId)
      .eq('team_id', input.teamId)
      .single();

    if (inboxError || !inbox) {
      throw new BadRequestException('Inbox not found');
    }

    // 2. Build variable map from test lead data + inbox sender fields
    const lead = input.testLead;
    const variables: Record<string, string> = {
      firstName: lead?.first_name ?? '',
      lastName: lead?.last_name ?? '',
      first_name: lead?.first_name ?? '',
      last_name: lead?.last_name ?? '',
      email: input.recipientEmail ?? '',
      company: lead?.company ?? '',
      title: lead?.title ?? '',
      phone: '',
      fullName: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(),
      full_name: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(),
      from_name: inbox.from_name ?? '',
      from_email: inbox.email ?? '',
      fromName: inbox.from_name ?? '',
      fromEmail: inbox.email ?? '',
      senderFirstName: inbox.sender_first_name ?? '',
      sender_first_name: inbox.sender_first_name ?? '',
      senderLastName: inbox.sender_last_name ?? '',
      sender_last_name: inbox.sender_last_name ?? '',
      senderCompany: inbox.sender_company ?? '',
      sender_company: inbox.sender_company ?? '',
      senderTitle: inbox.sender_title ?? '',
      sender_title: inbox.sender_title ?? '',
      senderPhone: inbox.sender_phone ?? '',
      sender_phone: inbox.sender_phone ?? '',
      senderWebsite: inbox.sender_website ?? '',
      sender_website: inbox.sender_website ?? '',
    };

    // 3. Smart template AI personalization BEFORE variable injection
    // AI must see raw {{variables}} so it preserves them; resolving first destroys them
    let processedSubject = input.subject;
    let processedBody = input.body;

    if (input.smartTemplateEnabled) {
      try {
        const language = input.smartTemplateLanguageMatch !== false
          ? getLanguageFromCountry(lead?.country)
          : undefined;

        const personalized = await this.aiService.personalizeEmail(
          processedSubject,
          processedBody,
          {
            firstName: lead?.first_name,
            lastName: lead?.last_name,
            company: lead?.company,
            title: lead?.title,
            analysisNotes: lead?.analysis_notes,
            country: lead?.country,
            city: lead?.city,
            linkedinUrl: lead?.linkedin_url,
            website: lead?.website,
          },
          input.smartTemplateTone || 'professional',
          language ? lead?.country : undefined,
          input.smartTemplateNotes,
          input.smartTemplateToneEnabled ?? false,
          input.smartTemplateLanguageMatch !== false,
          {
            firstName: inbox.sender_first_name || undefined,
            lastName: inbox.sender_last_name || undefined,
            company: inbox.sender_company || undefined,
            title: inbox.sender_title || undefined,
            website: inbox.sender_website || undefined,
          },
        );

        processedSubject = personalized.subject;
        processedBody = personalized.body;

        // Step 2: Apply whole-template tone and/or language transformation
        const toneLanguageResult = await this.aiService.applyToneAndLanguage(
          processedSubject,
          processedBody,
          input.smartTemplateTone || 'professional',
          input.smartTemplateToneEnabled ?? false,
          lead?.country,
          input.smartTemplateLanguageMatch !== false,
          input.smartTemplateNotes,
        );

        if (toneLanguageResult) {
          processedSubject = toneLanguageResult.subject;
          processedBody = toneLanguageResult.body;
        }
      } catch (err) {
        this.logger.warn('Smart template personalization failed for test, using processed template', err);
      }
    }

    // 4. Now resolve variables (spintax, conditionals, fallbacks) AFTER AI personalization
    processedSubject = processEmailContent(processedSubject, variables);
    processedBody = processEmailContent(processedBody, variables);

    // 5. Convert plain text newlines to HTML line breaks for email rendering
    processedBody = processedBody.replace(/\r?\n/g, '<br>\n');

    return { subject: processedSubject, body: processedBody };
  }

  async sendTest(input: TestEmailInput): Promise<{ success: boolean; subject: string; body: string }> {
    if (!input.recipientEmail) {
      throw new BadRequestException('Recipient email is required for sending test emails');
    }

    // Get preview content
    const { subject: processedSubject, body: processedBody } = await this.previewTest(input);

    // Fetch inbox for credentials
    const { data: inbox, error: inboxError } = await this.supabase
      .from('inboxes')
      .select('*')
      .eq('id', input.inboxId)
      .eq('team_id', input.teamId)
      .single();

    if (inboxError || !inbox) {
      throw new BadRequestException('Inbox not found');
    }

    if (inbox.status !== 'active' && inbox.status !== 'warming_up') {
      throw new BadRequestException(`Inbox is ${inbox.status} and cannot send emails`);
    }

    if (!inbox.oauth_access_token || !inbox.oauth_refresh_token) {
      throw new BadRequestException('Inbox credentials not configured');
    }

    // Decrypt credentials
    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = decrypt(inbox.oauth_access_token, this.encryptionKey);
      refreshToken = decrypt(inbox.oauth_refresh_token, this.encryptionKey);
    } catch (err) {
      this.logger.error(`Failed to decrypt credentials for inbox ${input.inboxId}: ${err}`);
      throw new BadRequestException('Inbox credentials are corrupted or invalid. Please reconnect your email account.');
    }

    // Convert HTML to plain text
    const textContent = processedBody
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    // Validate provider credentials
    if (inbox.provider === 'google' && (!this.googleClientId || !this.googleClientSecret)) {
      this.logger.error('Google OAuth credentials not configured');
      throw new InternalServerErrorException('Email provider is not configured. Please contact support.');
    }
    if (inbox.provider === 'microsoft' && (!this.microsoftClientId || !this.microsoftClientSecret)) {
      this.logger.error('Microsoft OAuth credentials not configured');
      throw new InternalServerErrorException('Email provider is not configured. Please contact support.');
    }

    // Send via appropriate email client
    try {
      if (inbox.provider === 'google') {
        const client = new GmailClient(
          {
            accessToken,
            refreshToken,
            expiresAt: inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined,
          },
          this.googleClientId,
          this.googleClientSecret,
        );

        await client.sendEmail({
          to: input.recipientEmail,
          from: inbox.email,
          fromName: inbox.from_name || undefined,
          subject: processedSubject,
          htmlBody: processedBody,
          textBody: textContent,
        });
      } else if (inbox.provider === 'microsoft') {
        const client = new MicrosoftClient(
          {
            accessToken,
            refreshToken,
            expiresAt: inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined,
          },
          {
            clientId: this.microsoftClientId,
            clientSecret: this.microsoftClientSecret,
          },
        );

        await client.sendEmail({
          to: input.recipientEmail,
          from: inbox.email,
          fromName: inbox.from_name || undefined,
          subject: processedSubject,
          htmlBody: processedBody,
          textBody: textContent,
        });
      } else {
        throw new BadRequestException('SMTP test emails are not yet supported');
      }
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof BadGatewayException || err instanceof InternalServerErrorException) {
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Test email send failed: ${errMsg}`);
      throw new BadGatewayException('Failed to send test email. Please check your inbox connection.');
    }

    return { success: true, subject: processedSubject, body: processedBody };
  }
}
