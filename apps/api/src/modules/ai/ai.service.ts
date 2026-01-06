import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

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
  }

  private async callOpenRouter(messages: OpenRouterMessage[], maxTokens = 1000): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.configService.get<string>('APP_URL') || 'http://localhost:3000',
        'X-Title': 'Cold Email Platform',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0]?.message?.content || '';
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

Rules:
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
      return {
        reply: parsed.reply || response,
        suggestedSubject: parsed.suggestedSubject || 'Re: ',
      };
    } catch {
      return {
        reply: response,
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

Guidelines:
- Write compelling, non-spammy emails
- Use personalization placeholders: {{first_name}}, {{company}}, {{title}}
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
      return JSON.parse(response);
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
