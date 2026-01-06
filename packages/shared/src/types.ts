// ============================================
// Core Types
// ============================================

export type InboxProvider = 'google' | 'microsoft' | 'smtp';
export type InboxStatus = 'active' | 'paused' | 'error' | 'warming_up' | 'banned';
export type WarmupPhase = 'ramping' | 'maintaining' | 'paused' | 'completed';
export type RampSpeed = 'slow' | 'normal' | 'fast';

export type LeadStatus =
  | 'pending'
  | 'in_sequence'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'not_interested'
  | 'meeting_booked'
  | 'bounced'
  | 'soft_bounced'
  | 'unsubscribed'
  | 'spam_reported'
  | 'sequence_complete';

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';
export type EmailStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

export type ReplyIntent =
  | 'interested'
  | 'meeting_request'
  | 'question'
  | 'not_interested'
  | 'unsubscribe'
  | 'out_of_office'
  | 'auto_reply'
  | 'bounce'
  | 'neutral';

export type EventType =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'deferred'
  | 'bounced'
  | 'soft_bounced'
  | 'opened'
  | 'clicked'
  | 'unsubscribed'
  | 'spam_reported';

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';
export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise';

// ============================================
// Entity Interfaces
// ============================================

export interface Team {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  dailyEmailLimit: number;
  maxInboxes: number;
  maxCampaigns: number;
  maxTeamMembers: number;
  physicalAddress?: string;
  companyName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  invitedAt?: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

export interface Inbox {
  id: string;
  teamId: string;
  email: string;
  fromName?: string;
  provider: InboxProvider;
  status: InboxStatus;
  statusReason?: string;
  healthScore: number;
  bounceRate7d: number;
  openRate7d: number;
  replyRate7d: number;
  sentToday: number;
  sentTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InboxSettings {
  id: string;
  inboxId: string;
  dailySendLimit: number;
  hourlyLimit: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendWindowTimezone: string;
  sendDays: string[];
  weekendsEnabled: boolean;
  espMatchingEnabled: boolean;
  autoThrottleEnabled: boolean;
}

export interface WarmupState {
  id: string;
  inboxId: string;
  enabled: boolean;
  phase: WarmupPhase;
  startedAt?: Date;
  currentDay: number;
  rampSpeed: RampSpeed;
  targetDailyVolume: number;
  sentToday: number;
  receivedToday: number;
  repliedToday: number;
  sentTotal: number;
  receivedTotal: number;
  repliedTotal: number;
}

export interface Lead {
  id: string;
  teamId: string;
  leadListId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
  website?: string;
  status: LeadStatus;
  replyIntent?: string;
  timezone?: string;
  country?: string;
  city?: string;
  customFields: Record<string, unknown>;
  unsubscribeToken: string;
  currentCampaignId?: string;
  currentStep?: number;
  nextSendAt?: Date;
  firstContactedAt?: Date;
  lastContactedAt?: Date;
  repliedAt?: Date;
  bouncedAt?: Date;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadList {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  leadCount: number;
  source?: string;
  importedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  id: string;
  teamId: string;
  leadListId?: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  settings: CampaignSettings;
  leadCount: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  scheduledStartAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  pausedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignSettings {
  timezone: string;
  sendDays: string[];
  stopOnReply: boolean;
  stopOnBounce: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
  espMatching: boolean;
  minHealthScore: number;
}

export interface Sequence {
  id: string;
  campaignId: string;
  stepNumber: number;
  delayDays: number;
  delayHours: number;
  subject: string;
  body: string;
  conditions: SequenceCondition[];
  sentCount: number;
  openedCount: number;
  repliedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceCondition {
  type: 'no_reply' | 'replied' | 'opened' | 'clicked' | 'bounced';
  action: 'continue' | 'stop' | 'move_to_step' | 'tag';
  targetStep?: number;
  tag?: string;
}

export interface SequenceVariant {
  id: string;
  sequenceId: string;
  variantIndex: number;
  weight: number;
  subject: string;
  body: string;
  sentCount: number;
  openedCount: number;
  repliedCount: number;
  isWinner: boolean;
  createdAt: Date;
}

export interface Email {
  id: string;
  teamId: string;
  campaignId?: string;
  sequenceId?: string;
  variantId?: string;
  leadId: string;
  inboxId: string;
  messageId?: string;
  threadId?: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  status: EmailStatus;
  errorMessage?: string;
  openTracked: boolean;
  clickTracked: boolean;
  openCount: number;
  clickCount: number;
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reply {
  id: string;
  teamId: string;
  emailId?: string;
  leadId: string;
  inboxId: string;
  campaignId?: string;
  messageId?: string;
  threadId?: string;
  inReplyTo?: string;
  fromEmail: string;
  fromName?: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  bodyPreview?: string;
  intent?: ReplyIntent;
  intentConfidence?: number;
  intentModel?: string;
  intentManualOverride: boolean;
  isRead: boolean;
  isArchived: boolean;
  receivedAt: Date;
  readAt?: Date;
  createdAt: Date;
}

// ============================================
// API Types
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Queue Job Types
// ============================================

export interface SendEmailJob {
  emailId: string;
  leadId: string;
  campaignId: string;
  inboxId: string;
  sequenceStep: number;
}

export interface WarmupSendJob {
  fromInboxId: string;
  toInboxId: string;
  messageType: 'warmup';
}

export interface WarmupReplyJob {
  originalMessageId: string;
  toInboxId: string;
  fromInboxId: string;
}

export interface ScanRepliesJob {
  inboxId: string;
  since?: Date;
}

export interface ProcessBounceJob {
  emailId: string;
  bounceType: 'hard' | 'soft';
  rawMessage: string;
}

// ============================================
// Webhook Types
// ============================================

export type WebhookEvent =
  | 'email.sent'
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'reply.received'
  | 'reply.interested'
  | 'reply.not_interested'
  | 'lead.bounced'
  | 'lead.unsubscribed'
  | 'campaign.started'
  | 'campaign.completed'
  | 'inbox.health_warning'
  | 'inbox.paused';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}
