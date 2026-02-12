import { z } from 'zod';

// ============================================
// Common Validators
// ============================================

export const emailSchema = z.string().email('Invalid email address');

export const uuidSchema = z.string().uuid('Invalid UUID');

export const timezoneSchema = z.string().min(1, 'Timezone is required');

export const urlSchema = z.string().url('Invalid URL');

// ============================================
// Inbox Schemas
// ============================================

export const createInboxSmtpSchema = z.object({
  email: emailSchema,
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUsername: z.string().min(1, 'SMTP username is required'),
  smtpPassword: z.string().min(1, 'SMTP password is required'),
  imapHost: z.string().min(1, 'IMAP host is required'),
  imapPort: z.number().int().min(1).max(65535),
  fromName: z.string().optional(),
  dailySendLimit: z.number().int().min(1).max(500).default(50),
});

export const updateInboxSettingsSchema = z.object({
  fromName: z.string().optional(),
  dailySendLimit: z.number().int().min(1).max(500).optional(),
  hourlyLimit: z.number().int().min(1).max(100).optional(),
  minDelaySeconds: z.number().int().min(30).max(3600).optional(),
  maxDelaySeconds: z.number().int().min(60).max(7200).optional(),
  sendWindowStart: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  sendWindowEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  sendWindowTimezone: timezoneSchema.optional(),
  weekendsEnabled: z.boolean().optional(),
});

export const enableWarmupSchema = z.object({
  rampSpeed: z.enum(['slow', 'normal', 'fast']).default('normal'),
  targetDailyVolume: z.number().int().min(10).max(100).default(40),
});

// ============================================
// Campaign Schemas
// ============================================

export const campaignSettingsSchema = z.object({
  timezone: timezoneSchema.default('America/New_York'),
  sendDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).default(['mon', 'tue', 'wed', 'thu', 'fri']),
  stopOnReply: z.boolean().default(true),
  stopOnBounce: z.boolean().default(true),
  trackOpens: z.boolean().default(true),
  trackClicks: z.boolean().default(false),
  espMatching: z.boolean().default(true),
  minHealthScore: z.number().int().min(0).max(100).default(70),
  schedule: z.record(
    z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
    z.array(z.object({
      start: z.number().int().min(0).max(24),
      end: z.number().int().min(0).max(24),
    })).min(1).max(2)
  ).optional(),
});

export const sequenceStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(0),
  delayHours: z.number().int().min(0).max(23).default(0),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  variants: z.array(z.object({
    subject: z.string().min(1).max(500),
    body: z.string().min(1),
    weight: z.number().int().min(1).max(100).default(50),
  })).optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  leadListId: uuidSchema,
  inboxIds: z.array(uuidSchema).min(1, 'At least one inbox is required'),
  settings: campaignSettingsSchema.optional(),
  sequences: z.array(sequenceStepSchema).min(1, 'At least one sequence step is required'),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: campaignSettingsSchema.partial().optional(),
});

// ============================================
// Lead Schemas
// ============================================

export const createLeadListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
});

export const leadImportMappingSchema = z.object({
  email: z.string().min(1, 'Email column is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  website: z.string().optional(),
  customFields: z.record(z.string()).optional(),
});

export const updateLeadSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  company: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  linkedinUrl: urlSchema.optional().or(z.literal('')),
  website: urlSchema.optional().or(z.literal('')),
  status: z.enum([
    'pending', 'in_sequence', 'contacted', 'replied', 'interested',
    'not_interested', 'meeting_booked', 'bounced', 'soft_bounced',
    'unsubscribed', 'spam_reported', 'sequence_complete'
  ]).optional(),
  customFields: z.record(z.unknown()).optional(),
});

// ============================================
// Reply Schemas
// ============================================

export const updateReplyIntentSchema = z.object({
  intent: z.enum([
    'interested', 'meeting_request', 'question', 'not_interested',
    'unsubscribe', 'out_of_office', 'auto_reply', 'bounce', 'neutral'
  ]),
});

export const sendReplySchema = z.object({
  body: z.string().min(1, 'Reply body is required'),
  inboxId: uuidSchema,
});

// ============================================
// Webhook Schemas
// ============================================

export const createWebhookSchema = z.object({
  url: urlSchema,
  events: z.array(z.enum([
    'email.sent', 'email.delivered', 'email.opened', 'email.clicked', 'email.bounced',
    'reply.received', 'reply.interested', 'reply.not_interested',
    'lead.bounced', 'lead.unsubscribed',
    'campaign.started', 'campaign.completed',
    'inbox.health_warning', 'inbox.paused'
  ])).min(1, 'At least one event is required'),
  secret: z.string().min(16, 'Secret must be at least 16 characters').optional(),
});

// ============================================
// Query Schemas
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// ============================================
// Type Exports
// ============================================

export type CreateInboxSmtp = z.infer<typeof createInboxSmtpSchema>;
export type UpdateInboxSettings = z.infer<typeof updateInboxSettingsSchema>;
export type EnableWarmup = z.infer<typeof enableWarmupSchema>;
export type CampaignSettings = z.infer<typeof campaignSettingsSchema>;
export type SequenceStep = z.infer<typeof sequenceStepSchema>;
export type CreateCampaign = z.infer<typeof createCampaignSchema>;
export type UpdateCampaign = z.infer<typeof updateCampaignSchema>;
export type CreateLeadList = z.infer<typeof createLeadListSchema>;
export type LeadImportMapping = z.infer<typeof leadImportMappingSchema>;
export type UpdateLead = z.infer<typeof updateLeadSchema>;
export type UpdateReplyIntent = z.infer<typeof updateReplyIntentSchema>;
export type SendReply = z.infer<typeof sendReplySchema>;
export type CreateWebhook = z.infer<typeof createWebhookSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
