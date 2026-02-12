// AI API Client for OpenRouter integration
// Calls the backend API which handles OpenRouter communication

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AIReplyResponse {
  reply: string;
  suggestedSubject: string;
}

interface AIIntentResponse {
  intent: string;
  confidence: number;
  reasoning: string;
}

interface AICampaignResponse {
  subject: string;
  firstEmail: string;
  followUp1: string;
  followUp2: string;
  breakupEmail: string;
}

interface AISpamCheckResponse {
  riskLevel: 'low' | 'medium' | 'high';
  score: number;
  issues: string[];
  suggestions: string[];
  rewrittenVersion?: string;
}

interface AIFollowUpResponse {
  subject: string;
  body: string;
  tone: string;
}

interface AIDailySummaryResponse {
  summary: string;
  highlights: string[];
  actionItems: string[];
  metrics: {
    totalReplies: number;
    interested: number;
    notInterested: number;
    needsAttention: number;
  };
}

interface AIBatchIntentResponse {
  id: string;
  intent: string;
  confidence: number;
}

interface AIObjectionResponse {
  detectedObjection: string;
  suggestedResponse: string;
  alternativeResponses: string[];
  tips: string[];
}

interface AIPersonalizeEmailResponse {
  subject: string;
  body: string;
}

async function aiRequest<T>(endpoint: string, body: Record<string, unknown>, token: string): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1/ai/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI request failed: ${error}`);
  }

  return response.json();
}

async function aiGet<T>(endpoint: string, params: Record<string, string>, token: string): Promise<T> {
  const searchParams = new URLSearchParams(params);
  const response = await fetch(`${API_URL}/api/v1/ai/${endpoint}?${searchParams}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI request failed: ${error}`);
  }

  return response.json();
}

export const aiClient = {
  // Generate AI Reply
  generateReply: (
    threadContext: string,
    originalEmail: string,
    tone: 'professional' | 'friendly' | 'short' | 'follow_up',
    senderName: string | undefined,
    token: string,
  ): Promise<AIReplyResponse> => {
    return aiRequest('generate-reply', {
      threadContext,
      originalEmail,
      tone,
      senderName,
    }, token);
  },

  // Detect Intent
  detectIntent: (
    emailContent: string,
    subject: string,
    token: string,
  ): Promise<AIIntentResponse> => {
    return aiRequest('detect-intent', {
      emailContent,
      subject,
    }, token);
  },

  // Generate Campaign Copy
  generateCampaign: (
    productDescription: string,
    targetAudience: string,
    tone: 'professional' | 'casual' | 'friendly' | 'urgent',
    senderName: string | undefined,
    companyName: string | undefined,
    token: string,
  ): Promise<AICampaignResponse> => {
    return aiRequest('generate-campaign', {
      productDescription,
      targetAudience,
      tone,
      senderName,
      companyName,
    }, token);
  },

  // Check Spam Risk
  checkSpamRisk: (
    emailContent: string,
    subject: string,
    token: string,
  ): Promise<AISpamCheckResponse> => {
    return aiRequest('check-spam', {
      emailContent,
      subject,
    }, token);
  },

  // Generate Follow-Up
  generateFollowUp: (
    originalEmail: string,
    previousFollowUps: string[],
    daysSinceLastEmail: number,
    token: string,
  ): Promise<AIFollowUpResponse> => {
    return aiRequest('generate-followup', {
      originalEmail,
      previousFollowUps,
      daysSinceLastEmail,
    }, token);
  },

  // Get Daily Summary
  getDailySummary: (
    teamId: string,
    token: string,
  ): Promise<AIDailySummaryResponse> => {
    return aiGet('daily-summary', { team_id: teamId }, token);
  },

  // Batch Detect Intent
  batchDetectIntent: (
    replies: Array<{ id: string; emailContent: string; subject: string }>,
    token: string,
  ): Promise<AIBatchIntentResponse[]> => {
    return aiRequest('batch-detect-intent', { replies }, token);
  },

  // Personalize Email (Smart Template)
  personalizeEmail: (
    subject: string,
    body: string,
    lead: { firstName?: string; lastName?: string; company?: string; title?: string; analysisNotes?: string },
    tone: string | undefined,
    country: string | undefined,
    token: string,
    toneEnabled?: boolean,
    languageMatch?: boolean,
  ): Promise<AIPersonalizeEmailResponse> => {
    return aiRequest('personalize-email', {
      subject,
      body,
      lead,
      tone,
      country,
      toneEnabled,
      languageMatch,
    }, token);
  },

  // Handle Objection
  handleObjection: (
    objectionEmail: string,
    objectionType: string | undefined,
    token: string,
  ): Promise<AIObjectionResponse> => {
    return aiRequest('handle-objection', {
      objectionEmail,
      objectionType,
    }, token);
  },
};

export type {
  AIReplyResponse,
  AIIntentResponse,
  AIBatchIntentResponse,
  AICampaignResponse,
  AISpamCheckResponse,
  AIFollowUpResponse,
  AIDailySummaryResponse,
  AIObjectionResponse,
  AIPersonalizeEmailResponse,
};
