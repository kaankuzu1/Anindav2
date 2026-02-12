import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isWithinSendWindow, isWithinPerDaySchedule, randomDelay, processEmailContent, leadStateMachine } from '@aninda/shared';
import type { LeadStatus } from '@aninda/shared';

interface SendEmailJob {
  emailId: string;
  leadId: string;
  campaignId: string;
  inboxId: string;
  sequenceStep: number;
}

interface Campaign {
  id: string;
  team_id: string;
  name: string;
  status: string;
  lead_list_id: string;
  settings: {
    send_window_start?: string;
    send_window_end?: string;
    timezone?: string;
    send_days?: string[];
    schedule?: Record<string, { start: number; end: number }[]>;
    track_opens?: boolean;
    track_clicks?: boolean;
    stop_on_reply?: boolean;
  };
}

interface Sequence {
  id: string;
  campaign_id: string;
  step_number: number;
  delay_days: number;
  delay_hours: number;
  subject: string;
  body_html: string;
}

interface Inbox {
  id: string;
  email: string;
  from_name: string | null;
  status: string;
  sent_today: number;
  daily_send_limit: number;
  throttle_percentage?: number;
  health_score?: number;
  effective_daily_limit?: number;
}

interface Lead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  status: string;
  custom_fields: Record<string, string> | null;
}

// Default settings
const DEFAULT_SEND_WINDOW_START = '09:00';
const DEFAULT_SEND_WINDOW_END = '17:00';
const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_SEND_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const MAX_EMAILS_PER_RUN = 100;
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_INBOX_HEALTH_SCORE = 50; // Skip inboxes below this health score

// Get sequence-blocking statuses from state machine
function getSequenceStopStatuses(): LeadStatus[] {
  // Use state machine to determine which statuses block the sequence
  const allStatuses: LeadStatus[] = [
    'pending', 'in_sequence', 'contacted', 'replied', 'interested',
    'not_interested', 'meeting_booked', 'bounced', 'soft_bounced',
    'unsubscribed', 'spam_reported', 'sequence_complete'
  ];
  return allStatuses.filter(status => leadStateMachine.blocksSequence(status));
}

type SequenceCondition = {
  type: 'no_reply' | 'no_open' | 'no_click' | 'replied' | 'opened' | 'clicked' | 'bounced';
  action: 'continue' | 'stop' | 'skip_step';
};

export class CampaignScheduler {
  private emailQueue: Queue<SendEmailJob>;
  private intervalId: NodeJS.Timeout | null = null;
  private inboxRotationIndex: Map<string, number> = new Map();

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {
    this.emailQueue = new Queue<SendEmailJob>('email-send', { connection: redis });
  }

  start() {
    console.log('Campaign scheduler started');

    // Run immediately and then every 5 minutes
    this.scheduleCampaigns();
    this.intervalId = setInterval(() => {
      this.scheduleCampaigns();
    }, SCHEDULER_INTERVAL_MS);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.emailQueue.close();
  }

  private async scheduleCampaigns() {
    try {
      console.log('Campaign scheduler: Checking for campaigns to process...');

      // Get all active campaigns
      const { data: campaigns, error: campaignError } = await this.supabase
        .from('campaigns')
        .select(`
          *,
          sequences(*),
          campaign_inboxes(
            inbox_id,
            inboxes(*)
          )
        `)
        .eq('status', 'active');

      if (campaignError) {
        console.error('Campaign scheduler: Failed to fetch campaigns:', campaignError);
        return;
      }

      if (!campaigns || campaigns.length === 0) {
        console.log('Campaign scheduler: No active campaigns found');
        return;
      }

      console.log(`Campaign scheduler: Found ${campaigns.length} active campaigns`);

      for (const campaign of campaigns) {
        await this.processCampaign(campaign);
      }
    } catch (error) {
      console.error('Campaign scheduler error:', error);
    }
  }

  private async processCampaign(campaign: Campaign & { sequences: Sequence[]; campaign_inboxes: { inbox_id: string; inboxes: Inbox }[] }) {
    try {
      const settings = campaign.settings || {};
      const sendWindowStart = settings.send_window_start || DEFAULT_SEND_WINDOW_START;
      const sendWindowEnd = settings.send_window_end || DEFAULT_SEND_WINDOW_END;
      const timezone = settings.timezone || DEFAULT_TIMEZONE;
      const sendDays = settings.send_days || DEFAULT_SEND_DAYS;

      // Check if within send window
      const now = new Date();
      if (settings.schedule && typeof settings.schedule === 'object' && Object.keys(settings.schedule).length > 0) {
        // New per-day schedule check
        if (!isWithinPerDaySchedule(now, settings.schedule, timezone)) {
          console.log(`Campaign "${campaign.name}": Outside per-day schedule, skipping`);
          return;
        }
      } else {
        // Legacy send window check
        if (!isWithinSendWindow(now, sendWindowStart, sendWindowEnd, timezone, sendDays)) {
          console.log(`Campaign "${campaign.name}": Outside send window, skipping`);
          return;
        }
      }

      // Get available inboxes (not at daily limit, healthy, and respecting throttle)
      const availableInboxes = (campaign.campaign_inboxes || [])
        .map(ci => ci.inboxes)
        .filter((inbox): inbox is Inbox =>
          inbox !== null &&
          inbox.status === 'active' &&
          (inbox.health_score ?? 100) >= MIN_INBOX_HEALTH_SCORE
        )
        .map(inbox => {
          // Apply throttle percentage to daily limit
          const throttlePercent = inbox.throttle_percentage ?? 100;
          const baseLimit = inbox.daily_send_limit || 50;
          const effectiveLimit = Math.floor(baseLimit * (throttlePercent / 100));
          return { ...inbox, effective_daily_limit: effectiveLimit };
        })
        .filter(inbox => (inbox.sent_today || 0) < inbox.effective_daily_limit);

      // Log skipped unhealthy inboxes
      const skippedInboxes = (campaign.campaign_inboxes || [])
        .map(ci => ci.inboxes)
        .filter((inbox) =>
          inbox !== null &&
          inbox.status === 'active' &&
          ((inbox as any).health_score ?? 100) < MIN_INBOX_HEALTH_SCORE
        );

      if (skippedInboxes.length > 0) {
        console.log(`Campaign "${campaign.name}": Skipped ${skippedInboxes.length} inboxes with low health score`);
      }

      if (availableInboxes.length === 0) {
        console.log(`Campaign "${campaign.name}": No available inboxes, skipping`);
        return;
      }

      // Sort sequences by step number
      const sequences = (campaign.sequences || []).sort((a, b) => a.step_number - b.step_number);

      if (sequences.length === 0) {
        console.log(`Campaign "${campaign.name}": No sequences defined, skipping`);
        return;
      }

      // Process each sequence step
      for (const sequence of sequences) {
        await this.processSequenceStep(campaign, sequence, availableInboxes);
      }

      // Mark leads as sequence_complete if they've finished all steps
      await this.markCompletedLeads(campaign.id, sequences.length);
    } catch (error) {
      console.error(`Campaign "${campaign.name}" error:`, error);
    }
  }

  /**
   * Mark leads as 'sequence_complete' if they've completed all sequence steps
   * This runs after processing all sequences for a campaign
   */
  private async markCompletedLeads(campaignId: string, totalSteps: number) {
    try {
      // Find leads who:
      // 1. Have completed the last sequence step (have a sent email for the final step)
      // 2. Are still in 'in_sequence' or 'contacted' status
      // 3. The email was sent more than the delay period ago (they're not waiting for follow-up)
      const { data: completedEmails, error } = await this.supabase
        .from('emails')
        .select(`
          lead_id,
          leads!inner(id, status)
        `)
        .eq('campaign_id', campaignId)
        .eq('sequence_step', totalSteps)
        .in('status', ['sent', 'delivered', 'opened', 'clicked']);

      if (error || !completedEmails || completedEmails.length === 0) {
        return;
      }

      // Filter to only leads that are still in sequence (not already replied, bounced, etc.)
      const leadsToComplete = completedEmails
        .filter(e => {
          const lead = e.leads as any;
          return lead && ['in_sequence', 'contacted'].includes(lead.status);
        })
        .map(e => e.lead_id);

      if (leadsToComplete.length === 0) {
        return;
      }

      // Remove duplicates
      const uniqueLeadIds = [...new Set(leadsToComplete)];

      // Update leads to sequence_complete
      const { error: updateError } = await this.supabase
        .from('leads')
        .update({ status: 'sequence_complete' })
        .in('id', uniqueLeadIds)
        .in('status', ['in_sequence', 'contacted']); // Double-check status to prevent race conditions

      if (updateError) {
        console.error('Failed to mark leads as sequence_complete:', updateError);
        return;
      }

      if (uniqueLeadIds.length > 0) {
        console.log(`Campaign: Marked ${uniqueLeadIds.length} leads as sequence_complete`);
      }
    } catch (error) {
      console.error('Error marking completed leads:', error);
    }
  }

  private async processSequenceStep(
    campaign: Campaign,
    sequence: Sequence,
    availableInboxes: Inbox[]
  ) {
    const isFirstStep = sequence.step_number === 1;
    const settings = campaign.settings || {};
    const stopOnReply = settings.stop_on_reply !== false; // Default: true

    // Get leads ready for this step
    let leads: Lead[];

    if (isFirstStep) {
      // Step 1: Get leads that haven't been contacted yet
      leads = await this.getLeadsForFirstStep(campaign.lead_list_id, campaign.team_id);
    } else {
      // Step N: Get leads who completed previous step and delay has passed
      leads = await this.getLeadsForFollowUp(campaign.id, sequence.step_number, sequence.delay_days, sequence.delay_hours, stopOnReply);
    }

    if (leads.length === 0) {
      return;
    }

    console.log(`Campaign "${campaign.name}" Step ${sequence.step_number}: ${leads.length} leads ready`);

    // Limit emails per run
    const leadsToProcess = leads.slice(0, MAX_EMAILS_PER_RUN);
    let emailsScheduled = 0;

    for (const lead of leadsToProcess) {
      // Check if any inbox still has capacity
      const inbox = this.selectInbox(campaign.id, availableInboxes);
      if (!inbox) {
        console.log(`Campaign "${campaign.name}": All inboxes at capacity`);
        break;
      }

      // Check suppression list
      const isSuppressed = await this.isEmailSuppressed(lead.email, campaign.team_id);
      if (isSuppressed) {
        continue;
      }

      // Check if email already exists for this lead/campaign/step
      const emailExists = await this.emailExistsForStep(lead.id, campaign.id, sequence.step_number);
      if (emailExists) {
        continue;
      }

      // Create email record
      const emailId = await this.createEmailRecord(campaign, sequence, lead, inbox);
      if (!emailId) {
        continue;
      }

      // Calculate delay with jitter for natural sending
      const baseDelay = emailsScheduled * randomDelay(30000, 120000); // 30s-2min between emails
      const jitter = randomDelay(0, 30000); // Up to 30s additional jitter
      const delay = baseDelay + jitter;

      // Queue the email
      const today = new Date().toISOString().split('T')[0];
      const jobId = `campaign-${campaign.id}-${lead.id}-${sequence.step_number}-${today}`;

      try {
        await this.emailQueue.add(
          'send-email',
          {
            emailId,
            leadId: lead.id,
            campaignId: campaign.id,
            inboxId: inbox.id,
            sequenceStep: sequence.step_number,
          },
          {
            delay,
            jobId,
            removeOnComplete: 100,
            removeOnFail: 50,
          }
        );

        emailsScheduled++;

        // Update inbox's projected sent count for this scheduler run
        inbox.sent_today = (inbox.sent_today || 0) + 1;

      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          // Job already queued, skip
        } else {
          console.error(`Failed to queue email for lead ${lead.id}:`, error);
        }
      }
    }

    if (emailsScheduled > 0) {
      console.log(`Campaign "${campaign.name}" Step ${sequence.step_number}: Scheduled ${emailsScheduled} emails`);
    }
  }

  private async getLeadsForFirstStep(leadListId: string, teamId: string): Promise<Lead[]> {
    const { data: leads, error } = await this.supabase
      .from('leads')
      .select('*')
      .eq('lead_list_id', leadListId)
      .eq('status', 'pending')
      .limit(MAX_EMAILS_PER_RUN);

    if (error) {
      console.error('Failed to fetch leads for first step:', error);
      return [];
    }

    return leads || [];
  }

  private async getLeadsForFollowUp(
    campaignId: string,
    stepNumber: number,
    delayDays: number,
    delayHours: number,
    stopOnReply: boolean = true
  ): Promise<Lead[]> {
    const previousStep = stepNumber - 1;
    const delayMs = (delayDays * 24 * 60 * 60 * 1000) + (delayHours * 60 * 60 * 1000);
    const cutoffTime = new Date(Date.now() - delayMs).toISOString();

    // Find leads who:
    // 1. Have a sent email for the previous step
    // 2. That email was sent before the delay cutoff
    // 3. Meet all sequence conditions (no reply, no bounce, etc.)
    // 4. Don't already have an email for this step
    const { data: eligibleEmails, error } = await this.supabase
      .from('emails')
      .select(`
        id,
        lead_id,
        open_count,
        click_count,
        status,
        leads!inner(*)
      `)
      .eq('campaign_id', campaignId)
      .eq('sequence_step', previousStep)
      .in('status', ['sent', 'delivered', 'opened', 'clicked']) // Accept any successfully sent status
      .lt('sent_at', cutoffTime);

    if (error) {
      console.error('Failed to fetch leads for follow-up:', error);
      return [];
    }

    if (!eligibleEmails || eligibleEmails.length === 0) {
      return [];
    }

    const leadIds = eligibleEmails.map(e => e.lead_id);

    // Check for leads whose sequence should be stopped (using state machine)
    const sequenceStopStatuses = getSequenceStopStatuses();
    const { data: stoppedLeads } = await this.supabase
      .from('leads')
      .select('id, status')
      .in('id', leadIds)
      .in('status', sequenceStopStatuses);

    const stoppedIds = new Set((stoppedLeads || []).map(l => l.id));

    // Check for existing emails at this step
    const { data: existingEmails } = await this.supabase
      .from('emails')
      .select('lead_id')
      .eq('campaign_id', campaignId)
      .eq('sequence_step', stepNumber)
      .in('lead_id', leadIds);

    const existingIds = new Set((existingEmails || []).map(e => e.lead_id));

    // Check for bounced emails (previous step might have bounced)
    const { data: bouncedEmails } = await this.supabase
      .from('emails')
      .select('lead_id')
      .eq('campaign_id', campaignId)
      .eq('status', 'bounced')
      .in('lead_id', leadIds);

    const bouncedIds = new Set((bouncedEmails || []).map(e => e.lead_id));

    // Check for replies to any email in this campaign (only if stopOnReply is enabled)
    let leadIdsWithReplies = new Set<string>();
    if (stopOnReply) {
      const { data: repliedEmails } = await this.supabase
        .from('replies')
        .select('email_id, emails!inner(lead_id)')
        .eq('emails.campaign_id', campaignId)
        .in('emails.lead_id', leadIds);

      leadIdsWithReplies = new Set(
        (repliedEmails || []).map(r => (r.emails as any)?.lead_id).filter(Boolean)
      );
    }

    // Return eligible leads that pass all conditions
    const leads: Lead[] = [];
    for (const email of eligibleEmails) {
      const lead = email.leads as unknown as Lead;
      const leadId = lead.id;

      // Skip if sequence should be stopped for this lead (status-based)
      if (stoppedIds.has(leadId)) {
        continue;
      }

      // Skip if any email to this lead bounced
      if (bouncedIds.has(leadId)) {
        continue;
      }

      // Skip if already has email for this step
      if (existingIds.has(leadId)) {
        continue;
      }

      // Skip if lead has replied to any campaign email (when stopOnReply is enabled)
      if (stopOnReply && leadIdsWithReplies.has(leadId)) {
        continue;
      }

      leads.push(lead);
    }

    return leads.slice(0, MAX_EMAILS_PER_RUN);
  }

  /**
   * Evaluate sequence conditions to determine if a lead should receive the next step.
   * Conditions can include: no_reply, no_open, no_click, replied, opened, clicked, bounced
   */
  private async evaluateSequenceConditions(
    campaignId: string,
    leadId: string,
    previousStepEmailId: string,
    conditions?: SequenceCondition[]
  ): Promise<{ shouldContinue: boolean; reason?: string }> {
    // Default conditions if none specified: stop on reply
    const activeConditions = conditions || [
      { type: 'no_reply' as const, action: 'continue' as const }
    ];

    // Get previous email details
    const { data: email } = await this.supabase
      .from('emails')
      .select('open_count, click_count, status')
      .eq('id', previousStepEmailId)
      .single();

    if (!email) {
      return { shouldContinue: false, reason: 'previous_email_not_found' };
    }

    // Check if lead has replied
    const { data: reply } = await this.supabase
      .from('replies')
      .select('id')
      .eq('email_id', previousStepEmailId)
      .single();

    const hasReplied = !!reply;
    const hasOpened = (email.open_count ?? 0) > 0;
    const hasClicked = (email.click_count ?? 0) > 0;
    const hasBounced = email.status === 'bounced';

    for (const condition of activeConditions) {
      switch (condition.type) {
        case 'no_reply':
          if (hasReplied && condition.action === 'continue') {
            return { shouldContinue: false, reason: 'lead_replied' };
          }
          break;
        case 'replied':
          if (hasReplied && condition.action === 'stop') {
            return { shouldContinue: false, reason: 'lead_replied' };
          }
          break;
        case 'no_open':
          if (hasOpened && condition.action === 'continue') {
            // If condition is "continue on no_open", stop if they did open
            return { shouldContinue: false, reason: 'lead_opened' };
          }
          break;
        case 'opened':
          if (hasOpened && condition.action === 'stop') {
            return { shouldContinue: false, reason: 'lead_opened' };
          }
          break;
        case 'no_click':
          if (hasClicked && condition.action === 'continue') {
            return { shouldContinue: false, reason: 'lead_clicked' };
          }
          break;
        case 'clicked':
          if (hasClicked && condition.action === 'stop') {
            return { shouldContinue: false, reason: 'lead_clicked' };
          }
          break;
        case 'bounced':
          if (hasBounced) {
            return { shouldContinue: false, reason: 'email_bounced' };
          }
          break;
      }
    }

    return { shouldContinue: true };
  }

  private selectInbox(campaignId: string, availableInboxes: Inbox[]): Inbox | null {
    // Filter inboxes that still have capacity (using effective limit with throttle)
    const inboxesWithCapacity = availableInboxes.filter(inbox => {
      const effectiveLimit = inbox.effective_daily_limit ?? inbox.daily_send_limit ?? 50;
      return (inbox.sent_today || 0) < effectiveLimit;
    });

    if (inboxesWithCapacity.length === 0) {
      return null;
    }

    // Round-robin selection
    const currentIndex = this.inboxRotationIndex.get(campaignId) || 0;
    const selectedInbox = inboxesWithCapacity[currentIndex % inboxesWithCapacity.length];
    this.inboxRotationIndex.set(campaignId, currentIndex + 1);

    return selectedInbox;
  }

  private async isEmailSuppressed(email: string, teamId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('suppression_list')
      .select('id')
      .eq('team_id', teamId)
      .eq('email', email.toLowerCase())
      .single();

    return !!data;
  }

  private async emailExistsForStep(leadId: string, campaignId: string, stepNumber: number): Promise<boolean> {
    const { data } = await this.supabase
      .from('emails')
      .select('id')
      .eq('lead_id', leadId)
      .eq('campaign_id', campaignId)
      .eq('sequence_step', stepNumber)
      .single();

    return !!data;
  }

  private async getThreadingData(
    campaignId: string,
    leadId: string,
    currentStep: number
  ): Promise<{
    inReplyTo: string;
    references: string;
    threadId: string;
    step1Subject: string;
  } | null> {
    if (currentStep <= 1) return null;

    const { data: previousEmails } = await this.supabase
      .from('emails')
      .select('sequence_step, message_id, thread_id, subject')
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId)
      .in('status', ['sent', 'delivered', 'opened', 'clicked'])
      .order('sequence_step', { ascending: true });

    if (!previousEmails?.length) return null;

    const priorEmails = previousEmails.filter(
      (e: any) => e.sequence_step < currentStep && e.message_id
    );
    if (priorEmails.length === 0) return null;

    const step1Email = priorEmails.find((e: any) => e.sequence_step === 1);
    const prevStepEmail = priorEmails[priorEmails.length - 1];

    return {
      inReplyTo: prevStepEmail.message_id,
      references: priorEmails.map((e: any) => e.message_id).join(' '),
      threadId: step1Email?.thread_id || prevStepEmail.thread_id || '',
      step1Subject: step1Email?.subject || prevStepEmail.subject || '',
    };
  }

  private selectVariant(variants: { id: string; subject: string; body: string; weight: number }[]): { id: string; subject: string; body: string } | null {
    if (!variants || variants.length === 0) return null;

    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);

    // If all weights are 0, fall back to first variant
    if (totalWeight === 0) return variants[0];

    let random = Math.random() * totalWeight;
    for (const variant of variants) {
      random -= (variant.weight || 0);
      if (random <= 0) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  private async createEmailRecord(
    campaign: Campaign,
    sequence: Sequence,
    lead: Lead,
    inbox: Inbox
  ): Promise<string | null> {
    // Process subject and body with lead variables
    const variables = {
      firstName: lead.first_name ?? '',
      lastName: lead.last_name ?? '',
      email: lead.email,
      company: lead.company ?? '',
      title: lead.title ?? '',
      ...(lead.custom_fields || {}),
    };

    // Check for A/B test variants
    let emailSubject = sequence.subject;
    let emailBody = sequence.body_html;
    let variantId: string | null = null;

    const { data: variants } = await this.supabase
      .from('sequence_variants')
      .select('id, subject, body, weight')
      .eq('sequence_id', sequence.id);

    if (variants && variants.length > 0) {
      const selected = this.selectVariant(variants);
      if (selected) {
        emailSubject = selected.subject;
        emailBody = selected.body;
        variantId = selected.id;
      }
    }

    // Get threading data for follow-up steps
    let threading: { inReplyTo: string; references: string; threadId: string; step1Subject: string } | null = null;
    if (sequence.step_number > 1) {
      threading = await this.getThreadingData(campaign.id, lead.id, sequence.step_number);
    }

    // Process subject — override with "Re:" for threaded follow-ups
    let processedSubject = processEmailContent(emailSubject, variables);
    if (threading?.step1Subject) {
      const baseSubject = threading.step1Subject.replace(/^Re:\s*/i, '');
      processedSubject = `Re: ${baseSubject}`;
    }

    const processedBody = processEmailContent(emailBody, variables);

    const { data, error } = await this.supabase
      .from('emails')
      .insert({
        team_id: campaign.team_id,
        campaign_id: campaign.id,
        sequence_id: sequence.id,
        sequence_step: sequence.step_number,
        lead_id: lead.id,
        inbox_id: inbox.id,
        from_email: inbox.email,
        from_name: inbox.from_name,
        to_email: lead.email,
        subject: processedSubject,
        body_html: processedBody,
        status: 'queued',
        variant_id: variantId,
        in_reply_to: threading?.inReplyTo || null,
        references_header: threading?.references || null,
        thread_id: threading?.threadId || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create email record:', error);
      return null;
    }

    return data?.id || null;
  }
}
