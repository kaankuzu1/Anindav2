import { Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GmailClient, MicrosoftClient, MicrosoftCredentials } from '@aninda/email-client';
import { processEmailContent, decrypt, encrypt, generateTrackingId, applyEmailTracking, getLanguageFromCountry } from '@aninda/shared';
import { shouldStopSequence, transitionLeadStatus } from './utils/lead-state';
import type { LeadStatus } from '@aninda/shared';

interface SendEmailJob {
  emailId: string;
  leadId: string;
  campaignId: string;
  inboxId: string;
  sequenceStep: number;
}

/**
 * Generate RFC 8058 compliant List-Unsubscribe headers
 */
function generateUnsubscribeHeaders(
  leadId: string,
  unsubscribeToken: string,
  apiUrl: string
): Record<string, string> {
  const unsubscribeUrl = `${apiUrl}/api/v1/unsubscribe/${unsubscribeToken}`;
  const unsubscribeMailto = `mailto:unsubscribe@${new URL(apiUrl).hostname}?subject=Unsubscribe&body=${leadId}`;

  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>, <${unsubscribeMailto}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export class EmailSenderWorker {
  private worker: Worker | null = null;
  private encryptionKey: string;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.encryptionKey = process.env.ENCRYPTION_KEY!;
  }

  start() {
    this.worker = new Worker<SendEmailJob>(
      'email-send',
      async (job) => this.processJob(job),
      {
        connection: this.redis,
        concurrency: 3, // Reduced concurrency for safer rate limiting
        limiter: {
          max: 2,       // Max 2 emails per second (Gmail API safe limit)
          duration: 1000,
        },
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Email job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Email job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      // Suppress connection reset errors
      if (!err.message.includes('ECONNRESET')) {
        console.error('Email worker error:', err.message);
      }
    });

    console.log('Email sender worker started');
  }

  async stop() {
    await this.worker?.close();
  }

  private async processJob(job: Job<SendEmailJob>) {
    const { emailId, leadId, inboxId } = job.data;

    // Get email record
    const { data: email, error: emailError } = await this.supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .single();

    if (emailError || !email) {
      throw new Error(`Email not found: ${emailId}`);
    }

    // Get inbox with credentials
    const { data: inbox, error: inboxError } = await this.supabase
      .from('inboxes')
      .select('*')
      .eq('id', inboxId)
      .single();

    if (inboxError || !inbox) {
      throw new Error(`Inbox not found: ${inboxId}`);
    }

    // Get lead for variable injection
    const { data: lead } = await this.supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    // SUPPRESSION RECHECK: Check if lead should be skipped (race condition prevention)
    // The lead status or suppression list may have changed since email was scheduled
    if (lead) {
      // Check lead status using state machine
      if (shouldStopSequence(lead.status as LeadStatus)) {
        console.log(`Email ${emailId}: Skipping - lead status is ${lead.status} (sequence blocked)`);
        // Mark email as failed with reason
        await this.supabase
          .from('emails')
          .update({
            status: 'failed',
            error_message: `Lead status changed to ${lead.status} before send`,
          })
          .eq('id', emailId);
        return { skipped: true, reason: `Lead status: ${lead.status}` };
      }

      // Check suppression list
      const { data: suppressed } = await this.supabase
        .from('suppression_list')
        .select('id')
        .eq('team_id', email.team_id)
        .eq('email', lead.email.toLowerCase())
        .single();

      if (suppressed) {
        console.log(`Email ${emailId}: Skipping - email is suppressed`);
        await this.supabase
          .from('emails')
          .update({
            status: 'failed',
            error_message: 'Email is in suppression list',
          })
          .eq('id', emailId);
        return { skipped: true, reason: 'Email suppressed' };
      }
    }

    // Decrypt credentials
    const accessToken = inbox.oauth_access_token
      ? decrypt(inbox.oauth_access_token, this.encryptionKey)
      : null;
    const refreshToken = inbox.oauth_refresh_token
      ? decrypt(inbox.oauth_refresh_token, this.encryptionKey)
      : null;

    if (!accessToken || !refreshToken) {
      throw new Error('Missing inbox credentials');
    }

    // Process email content with variables
    const variables: Record<string, string> = {
      // Lead variables (both formats)
      firstName: lead?.first_name ?? '',
      lastName: lead?.last_name ?? '',
      first_name: lead?.first_name ?? '',
      last_name: lead?.last_name ?? '',
      email: lead?.email ?? '',
      company: lead?.company ?? '',
      title: lead?.title ?? '',
      phone: lead?.phone ?? '',
      fullName: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(),
      full_name: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(),

      // Inbox variables (both formats)
      from_name: inbox.from_name ?? '',
      from_email: inbox.email ?? '',
      fromName: inbox.from_name ?? '',
      fromEmail: inbox.email ?? '',

      // Sender variables (both formats)
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

    // Spread custom_fields from lead into variables
    if (lead?.custom_fields && typeof lead.custom_fields === 'object') {
      for (const [key, value] of Object.entries(lead.custom_fields as Record<string, unknown>)) {
        if (typeof value === 'string') {
          variables[key] = value;
        }
      }
    }

    // Smart Template: AI personalization BEFORE variable injection
    // AI must see raw {{variables}} so it preserves them; resolving first destroys them
    let aiSubject = email.subject;
    let aiBody = email.body_html ?? '';

    if (email.sequence_id) {
      try {
        const smartConfig = await this.getSmartTemplateConfig(email.sequence_id, email.variant_id);
        if (smartConfig.enabled) {
          let personalized = false;

          // Step 1: Replace [placeholders] with AI-generated content
          const placeholderResult = await this.personalizeWithAI(aiSubject, aiBody, lead, smartConfig.tone, smartConfig.toneEnabled, smartConfig.languageMatch, smartConfig.notes, inbox);
          if (placeholderResult) {
            aiSubject = placeholderResult.subject;
            aiBody = placeholderResult.body;
            personalized = true;
          }

          // Step 2: Apply whole-template tone adjustment and/or language translation
          const toneLanguageResult = await this.applyToneAndLanguage(aiSubject, aiBody, smartConfig.tone, smartConfig.toneEnabled, lead, smartConfig.languageMatch, smartConfig.notes);
          if (toneLanguageResult) {
            aiSubject = toneLanguageResult.subject;
            aiBody = toneLanguageResult.body;
            personalized = true;
          }

          // Preserve "Re:" prefix for threaded follow-ups (AI might strip it)
          if (email.in_reply_to && aiSubject && !aiSubject.startsWith('Re:')) {
            aiSubject = `Re: ${aiSubject.replace(/^Re:\s*/i, '')}`;
          }

          // Mark email as personalized (non-blocking)
          if (personalized) {
            try {
              await this.supabase.from('emails').update({ smart_template_personalized: true }).eq('id', email.id);
            } catch (err) {
              console.warn('Failed to mark email as smart-template personalized:', err);
            }
          }
        }
      } catch (err) {
        console.warn('Smart Template config check failed, continuing with original content:', err);
      }
    }

    // Now resolve variables (spintax, conditionals, fallbacks) AFTER AI personalization
    let processedSubject = processEmailContent(aiSubject, variables);
    let processedBody = processEmailContent(aiBody, variables);

    // Convert plain text newlines to HTML line breaks for email rendering
    processedBody = processedBody.replace(/\r?\n/g, '<br>\n');

    // Apply email tracking if campaign has tracking enabled
    if (email.campaign_id) {
      const { data: campaign } = await this.supabase
        .from('campaigns')
        .select('settings')
        .eq('id', email.campaign_id)
        .single();

      const settings = campaign?.settings || {};
      const trackOpens = settings.track_opens !== false; // Default: true
      const trackClicks = settings.track_clicks !== false; // Default: true

      if (trackOpens || trackClicks) {
        const trackingId = generateTrackingId(emailId);
        const apiUrl = process.env.API_URL || 'http://localhost:3001';

        processedBody = applyEmailTracking(processedBody, trackingId, apiUrl, {
          trackOpens,
          trackClicks,
        });
      }
    }

    // Generate unsubscribe headers (RFC 8058 compliance)
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const unsubscribeToken = lead?.unsubscribe_token || leadId;
    const unsubscribeHeaders = generateUnsubscribeHeaders(leadId, unsubscribeToken, apiUrl);

    // Send email based on provider
    let messageId: string;

    try {
      if (inbox.provider === 'google') {
        const gmailClient = new GmailClient(
          { accessToken, refreshToken },
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!
        );

        const result = await gmailClient.sendEmail({
          to: email.to_email,
          from: email.from_email,
          fromName: email.from_name ?? undefined,
          subject: processedSubject,
          htmlBody: processedBody,
          headers: unsubscribeHeaders,
          inReplyTo: email.in_reply_to || undefined,
          references: email.references_header || undefined,
          threadId: email.thread_id || undefined,
        });

        messageId = result.messageId;
        // Store thread_id from Gmail response (critical for step 1 → step 2 threading)
        if (result.threadId) {
          email.thread_id = result.threadId;
        }
      } else if (inbox.provider === 'microsoft') {
        // Parse expiration time from inbox
        const expiresAt = inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined;

        const msClient = new MicrosoftClient(
          { accessToken, refreshToken, expiresAt },
          {
            clientId: process.env.MICROSOFT_CLIENT_ID!,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
            onTokenRefresh: async (newCredentials: MicrosoftCredentials) => {
              // Persist refreshed tokens to database
              const encryptedAccessToken = encrypt(newCredentials.accessToken, this.encryptionKey);
              const encryptedRefreshToken = encrypt(newCredentials.refreshToken, this.encryptionKey);

              await this.supabase
                .from('inboxes')
                .update({
                  oauth_access_token: encryptedAccessToken,
                  oauth_refresh_token: encryptedRefreshToken,
                  oauth_expires_at: newCredentials.expiresAt?.toISOString() ?? null,
                })
                .eq('id', inboxId);

              console.log(`Refreshed Microsoft token for inbox ${inbox.email}`);
            },
          }
        );

        const result = await msClient.sendEmail({
          to: email.to_email,
          from: email.from_email,
          fromName: email.from_name ?? undefined,
          subject: processedSubject,
          htmlBody: processedBody,
          headers: unsubscribeHeaders,
          inReplyTo: email.in_reply_to || undefined,
          references: email.references_header || undefined,
        });

        messageId = result.messageId;
        // Store conversationId from Microsoft response for threading
        if (result.conversationId) {
          email.thread_id = result.conversationId;
        }
      } else {
        throw new Error(`Unsupported provider: ${inbox.provider}`);
      }
    } catch (sendError: any) {
      if (this.isAuthError(sendError)) {
        console.error(`Email ${emailId}: Auth error — marking inbox ${inbox.email} as disconnected`);
        await this.markDisconnected(inboxId);
        await this.supabase
          .from('emails')
          .update({
            status: 'failed',
            error_message: 'Inbox disconnected — email account authorization expired',
          })
          .eq('id', emailId);
        // Non-retryable: throw with special marker
        const err = new Error('Inbox disconnected — authorization expired');
        (err as any).nonRetryable = true;
        throw err;
      }
      throw sendError;
    }

    // Update email record (store thread_id for future step threading)
    await this.supabase
      .from('emails')
      .update({
        status: 'sent',
        message_id: messageId,
        thread_id: email.thread_id || null,
        sent_at: new Date().toISOString(),
      })
      .eq('id', emailId);

    // Increment campaign sent count
    if (email.campaign_id) {
      try {
        await this.supabase.rpc('increment_campaign_sent', { campaign_id: email.campaign_id });
      } catch (err) {
        console.warn('Failed to increment campaign sent count:', err);
      }
    }

    // Update A/B test variant sent count
    if (email.variant_id) {
      try {
        await this.supabase.rpc('increment_variant_stat', {
          p_variant_id: email.variant_id,
          p_stat: 'sent',
        });
      } catch (err) {
        console.warn('Failed to increment variant sent count:', err);
      }
    }

    // Update inbox sent count
    await this.supabase
      .from('inboxes')
      .update({
        sent_today: (inbox.sent_today ?? 0) + 1,
        sent_total: (inbox.sent_total ?? 0) + 1,
        last_sent_at: new Date().toISOString(),
      })
      .eq('id', inboxId);

    // Update lead status using state machine
    const stateChange = await transitionLeadStatus(
      this.supabase,
      leadId,
      'EMAIL_SENT',
      { emailId, campaignId: email.campaign_id, messageId }
    );

    // If state machine blocked (e.g., already in terminal state), log but don't fail
    if (!stateChange) {
      console.warn(`State machine blocked EMAIL_SENT transition for lead ${leadId}`);
    }

    // Log event
    await this.supabase
      .from('email_events')
      .insert({
        team_id: email.team_id,
        email_id: emailId,
        event_type: 'sent',
      });

    return { messageId };
  }

  private async getSmartTemplateConfig(
    sequenceId: string,
    variantId: string | null,
  ): Promise<{ enabled: boolean; tone: string; toneEnabled: boolean; languageMatch: boolean; notes: string | null }> {
    // Try variant-level config first
    if (variantId) {
      const { data: variant } = await this.supabase
        .from('sequence_variants')
        .select('smart_template_enabled, smart_template_tone, smart_template_tone_enabled, smart_template_language_match, smart_template_notes')
        .eq('id', variantId)
        .single();

      if (variant?.smart_template_enabled != null) {
        return {
          enabled: !!variant.smart_template_enabled,
          tone: variant.smart_template_tone || 'professional',
          toneEnabled: !!variant.smart_template_tone_enabled,
          languageMatch: variant.smart_template_language_match !== false,
          notes: variant.smart_template_notes || null,
        };
      }
    }

    // Fall back to sequence-level config
    const { data: sequence } = await this.supabase
      .from('sequences')
      .select('smart_template_enabled, smart_template_tone, smart_template_tone_enabled, smart_template_language_match, smart_template_notes')
      .eq('id', sequenceId)
      .single();

    return {
      enabled: !!sequence?.smart_template_enabled,
      tone: sequence?.smart_template_tone || 'professional',
      toneEnabled: !!sequence?.smart_template_tone_enabled,
      languageMatch: sequence?.smart_template_language_match !== false,
      notes: sequence?.smart_template_notes || null,
    };
  }

  private buildLeadContextBlock(lead: any): string {
    const sections: string[] = [];

    const profile: string[] = [];
    if (lead?.first_name || lead?.last_name) {
      profile.push(`- Name: ${[lead?.first_name, lead?.last_name].filter(Boolean).join(' ')}`);
    }
    if (lead?.title) profile.push(`- Title: ${lead.title}`);
    if (lead?.company) profile.push(`- Company: ${lead.company}`);
    if (profile.length > 0) {
      sections.push(`RECIPIENT PROFILE:\n${profile.join('\n')}`);
    }

    const location: string[] = [];
    if (lead?.country) location.push(`- Country: ${lead.country}`);
    if (lead?.city) location.push(`- City: ${lead.city}`);
    if (location.length > 0) {
      sections.push(`LOCATION:\n${location.join('\n')}`);
    }

    const digital: string[] = [];
    if (lead?.linkedin_url) digital.push(`- LinkedIn: ${lead.linkedin_url}`);
    if (lead?.website) digital.push(`- Website: ${lead.website}`);
    if (digital.length > 0) {
      sections.push(`DIGITAL PRESENCE:\n${digital.join('\n')}`);
    }

    if (lead?.analysis_notes) {
      sections.push(`RESEARCH NOTES:\n${lead.analysis_notes}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'No lead information available.';
  }

  private buildSenderContextBlock(inbox: any): string {
    const lines: string[] = [];
    if (inbox?.sender_first_name || inbox?.sender_last_name) {
      lines.push(`- Name: ${[inbox.sender_first_name, inbox.sender_last_name].filter(Boolean).join(' ')}`);
    }
    if (inbox?.sender_title) lines.push(`- Title: ${inbox.sender_title}`);
    if (inbox?.sender_company) lines.push(`- Company: ${inbox.sender_company}`);
    if (inbox?.sender_website) lines.push(`- Website: ${inbox.sender_website}`);

    return lines.length > 0 ? `SENDER PROFILE:\n${lines.join('\n')}` : '';
  }

  private async personalizeWithAI(
    subject: string,
    body: string,
    lead: any,
    tone: string,
    toneEnabled: boolean,
    languageMatch: boolean,
    creatorNotes: string | null,
    inbox?: any,
  ): Promise<{ subject: string; body: string } | null> {
    // Find all [...] placeholders in BOTH subject and body
    const placeholderRegex = /\[([^\[\]]+)\]/g;
    const subjectPlaceholders: { full: string; instruction: string }[] = [];
    const bodyPlaceholders: { full: string; instruction: string }[] = [];
    let match;

    while ((match = placeholderRegex.exec(subject)) !== null) {
      subjectPlaceholders.push({ full: match[0], instruction: match[1] });
    }
    placeholderRegex.lastIndex = 0;
    while ((match = placeholderRegex.exec(body)) !== null) {
      bodyPlaceholders.push({ full: match[0], instruction: match[1] });
    }

    // No placeholders → skip AI entirely
    if (subjectPlaceholders.length === 0 && bodyPlaceholders.length === 0) {
      return null;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('Smart Template: OPENROUTER_API_KEY not set, skipping');
      return null;
    }

    const language = languageMatch ? getLanguageFromCountry(lead?.country) : 'English';
    const model = process.env.SMART_TEMPLATE_MODEL || 'openai/gpt-4o-mini';
    const leadContextBlock = this.buildLeadContextBlock(lead);
    const senderContextBlock = this.buildSenderContextBlock(inbox);

    const systemPrompt = `You are an elite B2B cold email copywriter specializing in personalized outreach.

YOUR TASK: Generate ONLY the text content for the placeholder described below. Return raw text — no JSON, no quotes, no labels.

WRITING RULES:
- Write a concise, natural sentence or phrase (1-3 sentences max)
- Reference SPECIFIC details from the recipient's profile (company name, role, industry, recent news)
- Sound like a real human wrote this — conversational, not corporate
- Match the email's existing voice and flow

CRITICAL DON'TS:
- Do NOT use generic filler ("I hope this finds you well", "I wanted to reach out", "I came across your profile")
- Do NOT include greetings ("Hi", "Dear") or sign-offs ("Best regards", "Thanks")
- Do NOT include template variables like {{firstName}} or {{company}}
- Do NOT use spam trigger words (free, guarantee, act now, limited time, exclusive offer)
- Do NOT use literal placeholders like [Your Name] or [Company Name]
- Do NOT mention AI, automation, or personalization
- Do NOT write more than 3 sentences

EXAMPLES OF GOOD OUTPUT:
- For "[personalized opening based on company]": "Noticed Acme Corp just closed your Series B — congrats. Scaling the SDR team at that pace usually means outbound infrastructure becomes a bottleneck fast."
- For "[value proposition]": "We help engineering-led teams like yours cut cold email setup time from weeks to hours, with built-in deliverability protection."
- For "[relevant pain point]": "Most VP-level folks I talk to at companies your size say their biggest challenge is getting replies without landing in spam."

EXAMPLES OF BAD OUTPUT (never write like this):
- "I hope this message finds you well. I wanted to reach out regarding..."
- "As a leader in your industry, you know the importance of..."
- "I came across your profile and was impressed by your work at..."`;

    const generateForPlaceholder = async (ph: { full: string; instruction: string }): Promise<{ full: string; content: string } | null> => {
      const userPrompt = `Generate content for this placeholder: "${ph.instruction}"

${leadContextBlock}

${senderContextBlock ? senderContextBlock + '\n' : ''}${creatorNotes ? `CAMPAIGN CREATOR INSTRUCTIONS (high priority): ${creatorNotes}\n` : ''}
Language: ${language}
Tone: ${toneEnabled ? tone : 'professional'}

Write ONLY the replacement text. Nothing else.`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.4,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            console.warn(`Smart Template: API returned ${response.status} for placeholder "${ph.instruction}"`);
            return null;
          }

          const data: any = await response.json();
          const content = data?.choices?.[0]?.message?.content?.trim();
          return content ? { full: ph.full, content } : null;
        } finally {
          clearTimeout(timeout);
        }
      } catch (err: any) {
        console.warn(`Smart Template: Failed to generate for placeholder "${ph.instruction}":`, err.message);
        return null;
      }
    };

    // Process subject placeholders
    let resultSubject = subject;
    for (const ph of subjectPlaceholders) {
      const result = await generateForPlaceholder(ph);
      if (result) {
        resultSubject = resultSubject.replace(result.full, result.content);
      }
    }

    // Process body placeholders
    let resultBody = body;
    for (const ph of bodyPlaceholders) {
      const result = await generateForPlaceholder(ph);
      if (result) {
        resultBody = resultBody.replace(result.full, result.content);
      }
    }

    return { subject: resultSubject, body: resultBody };
  }

  private async applyToneAndLanguage(
    subject: string,
    body: string,
    tone: string,
    toneEnabled: boolean,
    lead: any,
    languageMatch: boolean,
    creatorNotes: string | null,
  ): Promise<{ subject: string; body: string } | null> {
    const language = languageMatch ? getLanguageFromCountry(lead?.country) : 'English';
    const needsTone = toneEnabled && tone !== 'professional';
    const needsTranslation = languageMatch && language !== 'English';

    // Skip if neither tone nor language adjustment is needed
    if (!needsTone && !needsTranslation) {
      return null;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('applyToneAndLanguage: OPENROUTER_API_KEY not set, skipping');
      return null;
    }

    const instructions: string[] = [];
    if (needsTone) {
      instructions.push(`TONE ADJUSTMENT: Rewrite ONLY the body paragraphs to match a "${tone}" tone. Do NOT modify the greeting line (e.g., "Hi {{firstName}},") or the closing/signature. Keep the same meaning and structure, just adjust the tone of the body paragraphs.`);
    }
    if (needsTranslation) {
      instructions.push(`LANGUAGE TRANSLATION: Translate the ENTIRE email (subject line, greeting, body, and closing) into ${language}. Preserve all template syntax exactly as-is during translation.`);
    }

    const orderNote = needsTone && needsTranslation
      ? 'Apply the tone adjustment first, then translate the result.'
      : '';

    const systemPrompt = `You are an email language and tone specialist. Transform the email below according to the instructions.

ABSOLUTE RULES — BREAKING THESE FAILS THE TASK:
1. PRESERVE every {{variable}} placeholder EXACTLY (e.g., {{firstName}}, {{company}}, {{senderCompany}})
2. PRESERVE every HTML tag EXACTLY (e.g., <br>, <p>, <a href="...">)
3. PRESERVE every spintax pattern EXACTLY (e.g., {Hello|Hi|Hey})
4. PRESERVE every conditional block EXACTLY (e.g., {if:company}...{/if})
5. Do NOT add content that wasn't in the original (no new greetings, closings, or paragraphs)
6. Do NOT remove content that was in the original
7. Do NOT use spam trigger words (free, guarantee, act now, limited time)
8. Keep the email roughly the same length — do not expand or shrink significantly

Return ONLY a JSON object: {"subject": "...", "body": "..."}

${orderNote}`;

    const userPrompt = `${instructions.join('\n\n')}
${creatorNotes ? `\nCAMPAIGN CREATOR INSTRUCTIONS (high priority): ${creatorNotes}` : ''}

SUBJECT:
${subject}

BODY:
${body}

Return ONLY a JSON object: {"subject": "...", "body": "..."}`;

    const model = process.env.SMART_TEMPLATE_MODEL || 'openai/gpt-4o-mini';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.4,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          console.warn(`applyToneAndLanguage: API returned ${response.status}`);
          return null;
        }

        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (!content) return null;

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn('applyToneAndLanguage: Could not extract JSON from response');
          return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const resultSubject = parsed.subject || subject;
        return {
          subject: resultSubject,
          body: parsed.body || body,
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (err: any) {
      console.warn('applyToneAndLanguage failed:', err.message);
      return null;
    }
  }

  private isAuthError(err: any): boolean {
    const msg = (err?.message ?? '').toLowerCase();
    const code = String(err?.code ?? err?.statusCode ?? '');
    return (
      code === '401' ||
      code === '403' ||
      msg.includes('unauthorized') ||
      msg.includes('invalid_grant') ||
      msg.includes('invalid_client') ||
      msg.includes('token expired') ||
      msg.includes('token has been expired') ||
      msg.includes('token has been revoked') ||
      msg.includes('refresh token') ||
      msg.includes('authentication') ||
      msg.includes('auth_error') ||
      msg.includes('auth error') ||
      msg.includes('insufficient permissions')
    );
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
  }
}
