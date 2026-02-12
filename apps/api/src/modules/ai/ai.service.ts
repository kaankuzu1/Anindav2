import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { getLanguageFromCountry } from '@aninda/shared';

type ToneType = 'professional' | 'friendly' | 'short' | 'follow_up';
type IntentType = 'interested' | 'meeting_request' | 'question' | 'not_interested' | 'unsubscribe' | 'out_of_office' | 'auto_reply' | 'bounce' | 'neutral';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class AIService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly model = 'openai/gpt-4o-mini'; // Cost-effective model

  constructor(
    private configService: ConfigService,
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY') || '';
    console.log('[AI Service] Initialized with API key:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NOT CONFIGURED');
  }

  private async callOpenRouter(messages: OpenRouterMessage[], maxTokens = 1000, modelOverride?: string, temperature: number = 0.7): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your .env file.');
    }

    const effectiveModel = modelOverride || this.model;
    console.log('[AI Service] Calling OpenRouter with model:', effectiveModel);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.configService.get<string>('APP_URL') || 'http://localhost:3000',
        'X-Title': 'Cold Email Platform',
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[AI Service] OpenRouter API error:', response.status, error);
      throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    const data: OpenRouterResponse = await response.json();
    console.log('[AI Service] OpenRouter response received, tokens used:', data.usage?.total_tokens);
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Validate and fix AI-generated content for proper variable usage
   * Detects hardcoded names and replaces them with variable placeholders
   */
  private validateAndFixVariables(content: string): {
    fixed: string;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let fixed = content;

    // Detect hardcoded names like "Hi John," or "Dear Sarah,"
    const namePatterns = [
      /\b(Hi|Hello|Hey|Dear)\s+([A-Z][a-z]+)([,\s])/g,
      /\b(Mr\.|Ms\.|Mrs\.)\s+([A-Z][a-z]+)/g,
    ];

    for (const pattern of namePatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        warnings.push(`Detected hardcoded name: "${matches[0].trim()}"`);
        // Replace hardcoded names with variable placeholder
        fixed = fixed.replace(
          /\b(Hi|Hello|Hey|Dear)\s+([A-Z][a-z]+)([,\s])/g,
          '$1 {{firstName}}$3'
        );
      }
    }

    return { fixed, warnings };
  }

  // ============================================
  // 1. AI Reply Assistant
  // ============================================

  async generateReply(
    threadContext: string,
    originalEmail: string,
    tone: ToneType = 'professional',
    senderName?: string,
  ): Promise<{ reply: string; suggestedSubject: string }> {
    const toneInstructions = {
      professional: 'Use a formal, business-appropriate tone. Be polite and concise.',
      friendly: 'Use a warm, approachable tone while remaining professional.',
      short: 'Keep the reply very brief and to the point. Maximum 2-3 sentences.',
      follow_up: 'Write as a follow-up to a previous conversation. Reference the context naturally.',
    };

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an expert cold email assistant. Generate a reply to the incoming email.
${toneInstructions[tone]}

CRITICAL - Template Variables (MUST USE EXACTLY AS SHOWN):
- {{firstName}} or {{first_name}} - recipient's first name
- {{lastName}} or {{last_name}} - recipient's last name
- {{company}} - their company name
- {{title}} - their job title

IMPORTANT RULES:
1. ALWAYS use variable placeholders - NEVER write actual names
2. Example CORRECT: "Hi {{firstName}},"
3. Example WRONG: "Hi John," (hardcoded!)
4. If you want to use a name, you MUST use {{firstName}}

Other Rules:
- Never use spam words like "free", "limited time", "act now"
- Be genuine and helpful
- Match the recipient's communication style
- Keep it concise
- Include a clear next step or call to action when appropriate
${senderName ? `- Sign the email as "${senderName}"` : ''}

Return your response in this exact JSON format:
{
  "reply": "The email reply text",
  "suggestedSubject": "Re: Original subject or suggested subject"
}`,
      },
      {
        role: 'user',
        content: `Thread Context (previous emails):\n${threadContext}\n\nEmail to reply to:\n${originalEmail}\n\nGenerate an appropriate reply.`,
      },
    ];

    const response = await this.callOpenRouter(messages);

    try {
      const parsed = JSON.parse(response);
      const { fixed, warnings } = this.validateAndFixVariables(parsed.reply || response);

      if (warnings.length > 0) {
        console.warn('[AI] Variable validation warnings:', warnings);
      }

      return {
        reply: fixed,
        suggestedSubject: parsed.suggestedSubject || 'Re: ',
      };
    } catch {
      const { fixed } = this.validateAndFixVariables(response);
      return {
        reply: fixed,
        suggestedSubject: 'Re: ',
      };
    }
  }

  // ============================================
  // 2. AI Intent Detection
  // ============================================

  async detectIntent(emailContent: string, subject: string): Promise<{
    intent: IntentType;
    confidence: number;
    reasoning: string;
  }> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an email intent classifier. Analyze the email and classify it into one of these categories:

- interested: The sender shows genuine interest in the product/service
- meeting_request: The sender wants to schedule a call or meeting
- question: The sender has questions but hasn't decided yet
- not_interested: The sender explicitly declines or shows no interest
- unsubscribe: The sender wants to be removed from the mailing list
- out_of_office: This is an auto-reply about being away
- auto_reply: This is an automated response (not out of office)
- bounce: This is a delivery failure notification
- neutral: Cannot determine clear intent

Return your response in this exact JSON format:
{
  "intent": "one_of_the_categories_above",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this classification was chosen"
}`,
      },
      {
        role: 'user',
        content: `Subject: ${subject}\n\nEmail Content:\n${emailContent}`,
      },
    ];

    const response = await this.callOpenRouter(messages, 300);

    try {
      const parsed = JSON.parse(response);
      return {
        intent: parsed.intent || 'neutral',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || '',
      };
    } catch {
      return {
        intent: 'neutral',
        confidence: 0.5,
        reasoning: 'Could not parse AI response',
      };
    }
  }

  // ============================================
  // 3. AI Campaign Copy Generator
  // ============================================

  async generateCampaignCopy(input: {
    productDescription: string;
    targetAudience: string;
    tone: 'professional' | 'casual' | 'friendly' | 'urgent';
    senderName?: string;
    companyName?: string;
  }): Promise<{
    subject: string;
    firstEmail: string;
    followUp1: string;
    followUp2: string;
    breakupEmail: string;
  }> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an expert cold email copywriter. Generate a complete cold email campaign sequence.

CRITICAL - Template Variables (MUST USE EXACTLY AS SHOWN):
- {{first_name}} - lead's first name (REQUIRED in greeting)
- {{last_name}} - lead's last name
- {{company}} - their company name
- {{title}} - their job title

IMPORTANT RULES:
1. ALWAYS start with: "{Hi|Hello} {{first_name}},"
2. NEVER write actual names like "John"
3. Example CORRECT: "{Hi|Hello} {{first_name}},"
4. Example WRONG: "Hi John," or "Hello there,"

Also support:
- Spintax for variety: {Hello|Hi|Hey} (single braces)
- Conditionals: {if:company}I noticed you work at {{company}}.{/if}
- Fallbacks: {{company|your company}}

Guidelines:
- Write compelling, non-spammy emails
- Use personalization placeholders as shown above
- Each email should be 50-150 words
- Include clear calls to action
- Follow-ups should reference previous emails naturally
- The breakup email should create urgency without being pushy

Return your response in this exact JSON format:
{
  "subject": "First email subject line",
  "firstEmail": "First email body",
  "followUp1": "First follow-up email (sent 2-3 days after no reply)",
  "followUp2": "Second follow-up email (sent 4-5 days after no reply)",
  "breakupEmail": "Final breakup email (sent 7+ days after no reply)"
}`,
      },
      {
        role: 'user',
        content: `Generate a cold email campaign for:

Product/Service: ${input.productDescription}
Target Audience: ${input.targetAudience}
Tone: ${input.tone}
${input.senderName ? `Sender Name: ${input.senderName}` : ''}
${input.companyName ? `Company: ${input.companyName}` : ''}`,
      },
    ];

    const response = await this.callOpenRouter(messages, 2000);

    try {
      const parsed = JSON.parse(response);

      return {
        subject: parsed.subject,
        firstEmail: this.validateAndFixVariables(parsed.firstEmail).fixed,
        followUp1: this.validateAndFixVariables(parsed.followUp1).fixed,
        followUp2: this.validateAndFixVariables(parsed.followUp2).fixed,
        breakupEmail: this.validateAndFixVariables(parsed.breakupEmail).fixed,
      };
    } catch {
      throw new Error('Failed to generate campaign copy');
    }
  }

  // ============================================
  // 4. AI Spam Risk Checker
  // ============================================

  async checkSpamRisk(emailContent: string, subject: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    score: number;
    issues: string[];
    suggestions: string[];
    rewrittenVersion?: string;
  }> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an email deliverability expert. Analyze the email for spam risk factors.

Check for:
- Spam trigger words (free, limited time, act now, guaranteed, etc.)
- Excessive punctuation or ALL CAPS
- Too many links
- Aggressive sales language
- Missing personalization
- Email length issues
- Suspicious patterns

Return your response in this exact JSON format:
{
  "riskLevel": "low|medium|high",
  "score": 0-100,
  "issues": ["List of specific issues found"],
  "suggestions": ["List of suggestions to improve"],
  "rewrittenVersion": "If risk is medium or high, provide a safer rewritten version"
}`,
      },
      {
        role: 'user',
        content: `Subject: ${subject}\n\nEmail Body:\n${emailContent}`,
      },
    ];

    const response = await this.callOpenRouter(messages, 1500);

    try {
      return JSON.parse(response);
    } catch {
      return {
        riskLevel: 'low',
        score: 0,
        issues: [],
        suggestions: [],
      };
    }
  }

  // ============================================
  // 5. AI Follow-Up Generator
  // ============================================

  async generateFollowUp(
    originalEmail: string,
    previousFollowUps: string[],
    daysSinceLastEmail: number,
  ): Promise<{
    subject: string;
    body: string;
    tone: string;
  }> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an expert at writing follow-up emails that get responses.

Rules:
- Never repeat the exact same content as previous emails
- Reference the original email naturally
- Keep it short (50-100 words)
- Include a new angle or value proposition
- End with a clear, simple question
- Avoid being pushy or desperate

Return your response in this exact JSON format:
{
  "subject": "Follow-up subject line (can be Re: original or new)",
  "body": "The follow-up email body",
  "tone": "Description of the tone used (e.g., 'casual reminder', 'value-focused')"
}`,
      },
      {
        role: 'user',
        content: `Original Email:\n${originalEmail}

${previousFollowUps.length > 0 ? `Previous Follow-ups:\n${previousFollowUps.join('\n---\n')}` : 'No previous follow-ups sent.'}

Days since last email: ${daysSinceLastEmail}

Generate a fresh follow-up that adds value and is different from previous emails.`,
      },
    ];

    const response = await this.callOpenRouter(messages, 800);

    try {
      return JSON.parse(response);
    } catch {
      throw new Error('Failed to generate follow-up');
    }
  }

  // ============================================
  // 6. AI Daily Summary
  // ============================================

  async generateDailySummary(teamId: string): Promise<{
    summary: string;
    highlights: string[];
    actionItems: string[];
    metrics: {
      totalReplies: number;
      interested: number;
      notInterested: number;
      needsAttention: number;
    };
  }> {
    // Fetch today's data
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: replies } = await this.supabase
      .from('replies')
      .select('*, leads(first_name, company)')
      .eq('team_id', teamId)
      .gte('received_at', today.toISOString());

    const { data: emailsSent } = await this.supabase
      .from('emails')
      .select('id, status')
      .eq('team_id', teamId)
      .gte('sent_at', today.toISOString());

    const replyData = replies ?? [];
    const emailData = emailsSent ?? [];

    const metrics = {
      totalReplies: replyData.length,
      interested: replyData.filter((r) => r.intent === 'interested' || r.intent === 'meeting_request').length,
      notInterested: replyData.filter((r) => r.intent === 'not_interested' || r.intent === 'unsubscribe').length,
      needsAttention: replyData.filter((r) => !r.is_read && r.intent !== 'out_of_office' && r.intent !== 'auto_reply').length,
    };

    if (replyData.length === 0) {
      return {
        summary: 'No new replies received today.',
        highlights: [],
        actionItems: ['Keep monitoring your inbox for responses.'],
        metrics,
      };
    }

    // Generate AI summary
    const replyContext = replyData.slice(0, 10).map((r) => ({
      from: r.from_name || r.from_email,
      company: r.leads?.company || 'Unknown',
      intent: r.intent || 'unclassified',
      preview: r.body_preview?.substring(0, 100) || '',
    }));

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an email activity analyst. Generate a brief daily summary of email activity.

Return your response in this exact JSON format:
{
  "summary": "A 2-3 sentence summary of today's activity",
  "highlights": ["List of 2-4 notable highlights"],
  "actionItems": ["List of 2-4 recommended actions to take"]
}`,
      },
      {
        role: 'user',
        content: `Today's email activity:
- Emails sent: ${emailData.length}
- Replies received: ${replyData.length}
- Interested responses: ${metrics.interested}
- Not interested: ${metrics.notInterested}
- Needs attention: ${metrics.needsAttention}

Recent replies preview:
${JSON.stringify(replyContext, null, 2)}`,
      },
    ];

    const response = await this.callOpenRouter(messages, 500);

    try {
      const parsed = JSON.parse(response);
      return {
        ...parsed,
        metrics,
      };
    } catch {
      return {
        summary: `You received ${metrics.totalReplies} replies today. ${metrics.interested} showed interest and ${metrics.needsAttention} need your attention.`,
        highlights: [],
        actionItems: metrics.needsAttention > 0
          ? [`Review ${metrics.needsAttention} unread replies that need attention.`]
          : ['All caught up! Consider following up with leads who haven\'t replied.'],
        metrics,
      };
    }
  }

  // ============================================
  // 7. AI Objection Handling
  // ============================================

  async handleObjection(
    objectionEmail: string,
    objectionType?: string,
  ): Promise<{
    detectedObjection: string;
    suggestedResponse: string;
    alternativeResponses: string[];
    tips: string[];
  }> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an expert at handling sales objections via email. Analyze the objection and provide response options.

Common objections and approaches:
- "Too expensive" -> Focus on value and ROI
- "No time" -> Offer flexibility, async options
- "Not interested" -> Acknowledge, leave door open
- "Using competitor" -> Highlight differentiators
- "Need to think about it" -> Offer more info, create gentle urgency
- "Talk to team" -> Offer to join the conversation

Return your response in this exact JSON format:
{
  "detectedObjection": "Type of objection detected (e.g., price, timing, interest)",
  "suggestedResponse": "Primary recommended email response (50-100 words)",
  "alternativeResponses": ["2-3 alternative response options"],
  "tips": ["2-3 tips for handling this type of objection"]
}`,
      },
      {
        role: 'user',
        content: `${objectionType ? `Suspected objection type: ${objectionType}\n\n` : ''}Email with objection:\n${objectionEmail}`,
      },
    ];

    const response = await this.callOpenRouter(messages, 1200);

    try {
      return JSON.parse(response);
    } catch {
      throw new Error('Failed to generate objection response');
    }
  }

  // ============================================
  // 8. AI CSV Column Mapping
  // ============================================

  async mapCsvColumns(
    headers: string[],
    sampleRows: string[][],
  ): Promise<Record<string, string | null>> {
    const targetFields = [
      { field: 'email', description: 'Email address (required)' },
      { field: 'first_name', description: 'First name / given name' },
      { field: 'last_name', description: 'Last name / surname / family name' },
      { field: 'company', description: 'Company / organization name' },
      { field: 'title', description: 'Job title / position / role' },
      { field: 'phone', description: 'Phone number' },
      { field: 'linkedin_url', description: 'LinkedIn profile URL' },
      { field: 'website', description: 'Website URL' },
      { field: 'country', description: 'Country' },
      { field: 'city', description: 'City' },
      { field: 'timezone', description: 'Timezone' },
      { field: 'analysis_notes', description: 'Analysis notes / research notes about the lead' },
    ];

    const sampleData = sampleRows.slice(0, 3).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? '';
      });
      return obj;
    });

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are a data mapping expert. Given CSV column headers and sample data, determine which lead field each column maps to.

Available target fields:
${targetFields.map((f) => `- "${f.field}": ${f.description}`).join('\n')}

Rules:
1. Each target field can only be mapped once
2. If a column doesn't match any target field, map it to null
3. Use the column header name AND the sample data to make your decision
4. Common aliases: "org"/"organization" -> company, "role"/"position" -> title, "nombre" -> first_name, "apellido" -> last_name, "correo" -> email, "telefono" -> phone, "empresa" -> company, etc.
5. Be smart about multi-language headers

Return ONLY a JSON object mapping each CSV header to a target field name or null.
Example: {"Email Address": "email", "First": "first_name", "Revenue": null}`,
      },
      {
        role: 'user',
        content: `CSV Headers: ${JSON.stringify(headers)}

Sample data (first 3 rows):
${JSON.stringify(sampleData, null, 2)}

Map each header to the most appropriate target field or null.`,
      },
    ];

    try {
      const response = await this.callOpenRouter(messages, 500);
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[AI] Could not extract JSON from column mapping response');
        return {};
      }
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate: only allow known target fields
      const validFields = new Set(targetFields.map((f) => f.field));
      const result: Record<string, string | null> = {};
      for (const header of headers) {
        const mapped = parsed[header];
        if (mapped && validFields.has(mapped)) {
          result[header] = mapped;
        } else {
          result[header] = null;
        }
      }

      return result;
    } catch (error) {
      console.warn('[AI] Column mapping failed, returning empty mapping:', error);
      return {};
    }
  }

  // ============================================
  // 9. AI Smart Template Personalization
  // ============================================

  /**
   * Build a structured lead context block for AI prompts
   */
  private buildLeadContextBlock(lead: {
    firstName?: string; lastName?: string; company?: string; title?: string;
    analysisNotes?: string; country?: string; city?: string;
    linkedinUrl?: string; website?: string;
  }): string {
    const sections: string[] = [];

    // Recipient profile
    const profile: string[] = [];
    if (lead.firstName || lead.lastName) {
      profile.push(`- Name: ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')}`);
    }
    if (lead.title) profile.push(`- Title: ${lead.title}`);
    if (lead.company) profile.push(`- Company: ${lead.company}`);
    if (profile.length > 0) {
      sections.push(`RECIPIENT PROFILE:\n${profile.join('\n')}`);
    }

    // Location
    const location: string[] = [];
    if (lead.country) location.push(`- Country: ${lead.country}`);
    if (lead.city) location.push(`- City: ${lead.city}`);
    if (location.length > 0) {
      sections.push(`LOCATION:\n${location.join('\n')}`);
    }

    // Digital presence
    const digital: string[] = [];
    if (lead.linkedinUrl) digital.push(`- LinkedIn: ${lead.linkedinUrl}`);
    if (lead.website) digital.push(`- Website: ${lead.website}`);
    if (digital.length > 0) {
      sections.push(`DIGITAL PRESENCE:\n${digital.join('\n')}`);
    }

    // Research notes
    if (lead.analysisNotes) {
      sections.push(`RESEARCH NOTES:\n${lead.analysisNotes}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'No lead information available.';
  }

  /**
   * Build a structured sender context block for AI prompts
   */
  private buildSenderContextBlock(sender?: {
    firstName?: string; lastName?: string; company?: string;
    title?: string; website?: string;
  }): string {
    if (!sender) return '';

    const lines: string[] = [];
    if (sender.firstName || sender.lastName) {
      lines.push(`- Name: ${[sender.firstName, sender.lastName].filter(Boolean).join(' ')}`);
    }
    if (sender.title) lines.push(`- Title: ${sender.title}`);
    if (sender.company) lines.push(`- Company: ${sender.company}`);
    if (sender.website) lines.push(`- Website: ${sender.website}`);

    return lines.length > 0 ? `SENDER PROFILE:\n${lines.join('\n')}` : '';
  }

  async personalizeEmail(
    subject: string,
    body: string,
    lead: {
      firstName?: string; lastName?: string; company?: string; title?: string;
      analysisNotes?: string; country?: string; city?: string;
      linkedinUrl?: string; website?: string;
    },
    tone: string = 'professional',
    country?: string,
    creatorNotes?: string,
    toneEnabled: boolean = false,
    languageMatch: boolean = true,
    sender?: {
      firstName?: string; lastName?: string; company?: string;
      title?: string; website?: string;
    },
  ): Promise<{ subject: string; body: string }> {
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

    // No placeholders → return original
    if (subjectPlaceholders.length === 0 && bodyPlaceholders.length === 0) {
      return { subject, body };
    }

    const language = languageMatch ? getLanguageFromCountry(country) : 'English';
    const leadContextBlock = this.buildLeadContextBlock(lead);
    const senderContextBlock = this.buildSenderContextBlock(sender);
    const smartModel = this.configService.get<string>('SMART_TEMPLATE_MODEL') || 'openai/gpt-4o-mini';

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
      try {
        const userPrompt = `Generate content for this placeholder: "${ph.instruction}"

${leadContextBlock}

${senderContextBlock ? senderContextBlock + '\n' : ''}${creatorNotes ? `CAMPAIGN CREATOR INSTRUCTIONS (high priority): ${creatorNotes}\n` : ''}
Language: ${language}
Tone: ${toneEnabled ? tone : 'professional'}

Write ONLY the replacement text. Nothing else.`;

        const messages: OpenRouterMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        const response = await this.callOpenRouter(messages, 500, smartModel, 0.4);
        const content = response?.trim();
        return content ? { full: ph.full, content } : null;
      } catch (err) {
        console.warn(`[AI] Failed to generate for placeholder "${ph.instruction}":`, err);
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

  // ============================================
  // 10. AI Tone & Language Transformation
  // ============================================

  async applyToneAndLanguage(
    subject: string,
    body: string,
    tone: string,
    toneEnabled: boolean,
    country: string | undefined,
    languageMatch: boolean,
    creatorNotes?: string | null,
  ): Promise<{ subject: string; body: string } | null> {
    const language = languageMatch ? getLanguageFromCountry(country) : 'English';
    const needsTone = toneEnabled && tone !== 'professional';
    const needsTranslation = languageMatch && language !== 'English';

    // Skip if neither tone nor language adjustment is needed
    if (!needsTone && !needsTranslation) {
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

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an email language and tone specialist. Transform the email below according to the instructions.

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

${orderNote}`,
      },
      {
        role: 'user',
        content: `${instructions.join('\n\n')}
${creatorNotes ? `\nCAMPAIGN CREATOR INSTRUCTIONS (high priority): ${creatorNotes}` : ''}

SUBJECT:
${subject}

BODY:
${body}

Return ONLY a JSON object: {"subject": "...", "body": "..."}`,
      },
    ];

    const smartModel = this.configService.get<string>('SMART_TEMPLATE_MODEL') || 'openai/gpt-4o-mini';

    try {
      const response = await this.callOpenRouter(messages, 2000, smartModel, 0.4);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[AI] applyToneAndLanguage: Could not extract JSON from response');
        return null;
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        subject: parsed.subject || subject,
        body: parsed.body || body,
      };
    } catch (err) {
      console.warn('[AI] applyToneAndLanguage failed:', err);
      return null;
    }
  }

  // ============================================
  // Batch Intent Detection (for workers)
  // ============================================

  async batchDetectIntent(emails: Array<{ id: string; subject: string; body: string }>): Promise<
    Array<{ id: string; intent: IntentType; confidence: number }>
  > {
    const results = await Promise.all(
      emails.map(async (email) => {
        const result = await this.detectIntent(email.body, email.subject);
        return {
          id: email.id,
          intent: result.intent,
          confidence: result.confidence,
        };
      }),
    );
    return results;
  }
}
