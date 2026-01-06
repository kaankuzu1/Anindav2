// Export types
export * from './types';

// Export validation schemas and their inferred types (without CampaignSettings which conflicts)
export {
  emailSchema,
  uuidSchema,
  timezoneSchema,
  urlSchema,
  createInboxSmtpSchema,
  updateInboxSettingsSchema,
  enableWarmupSchema,
  campaignSettingsSchema,
  sequenceStepSchema,
  createCampaignSchema,
  updateCampaignSchema,
  createLeadListSchema,
  leadImportMappingSchema,
  updateLeadSchema,
  updateReplyIntentSchema,
  sendReplySchema,
  createWebhookSchema,
  paginationSchema,
  dateRangeSchema,
  // Inferred types
  type CreateInboxSmtp,
  type UpdateInboxSettings,
  type EnableWarmup,
  type SequenceStep,
  type CreateCampaign,
  type UpdateCampaign,
  type CreateLeadList,
  type LeadImportMapping,
  type UpdateLead,
  type UpdateReplyIntent,
  type SendReply,
  type CreateWebhook,
  type Pagination,
  type DateRange,
} from './validation';

// Rename the zod-inferred CampaignSettings to avoid conflict with types.ts
export { type CampaignSettings as CampaignSettingsInput } from './validation';

// Export utilities
export * from './utils';
