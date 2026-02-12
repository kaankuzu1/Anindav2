/**
 * Smart Scheduler Worker
 * 
 * Enhances the campaign scheduler with send time optimization.
 * Uses lead timezone and historical data to schedule emails
 * at the optimal time for each recipient.
 */

import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateOptimalSendTime,
  calculateBatchSendTimes,
  isWithinOptimalWindow,
  getDayScore,
  inferTimezoneFromEmail,
  inferTimezoneFromLocation,
  type OptimalSendTime,
  type SendTimeConfig,
  type LeadOpenHistory,
} from '@aninda/shared';

interface ScheduleEmailJob {
  emailId: string;
  leadId: string;
  campaignId: string;
  inboxId: string;
  sequenceStep: number;
  scheduledAt: Date;
  timezone: string;
  optimizationApplied: boolean;
}

interface Lead {
  id: string;
  email: string;
  timezone: string | null;
  country: string | null;
  city: string | null;
}

interface EmailEvent {
  email_id: string;
  lead_id: string;
  event_type: string;
  created_at: string;
}

// Default configuration
const DEFAULT_CONFIG: SendTimeConfig = {
  defaultWindowStart: 9,
  defaultWindowEnd: 11,
  preferredDays: [2, 3, 4], // Tuesday, Wednesday, Thursday
  useHistoricalData: true,
  senderTimezone: 'America/New_York',
};

export class SmartScheduler {
  private emailQueue: Queue<ScheduleEmailJob>;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
    private readonly config: Partial<SendTimeConfig> = {},
  ) {
    this.emailQueue = new Queue<ScheduleEmailJob>('smart-email-send', { connection: redis });
  }

  /**
   * Get historical open data for a lead
   */
  async getLeadOpenHistory(leadId: string): Promise<LeadOpenHistory[]> {
    const { data: events, error } = await this.supabase
      .from('email_events')
      .select('created_at')
      .eq('lead_id', leadId)
      .eq('event_type', 'opened')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !events) {
      return [];
    }

    return events.map((event) => {
      const date = new Date(event.created_at);
      return {
        openedAt: date,
        dayOfWeek: date.getDay(),
        hourOfDay: date.getHours(),
      };
    });
  }

  /**
   * Get historical open data for multiple leads
   */
  async getBatchOpenHistory(leadIds: string[]): Promise<Map<string, LeadOpenHistory[]>> {
    const historyMap = new Map<string, LeadOpenHistory[]>();

    if (leadIds.length === 0) return historyMap;

    const { data: events, error } = await this.supabase
      .from('email_events')
      .select('lead_id, created_at')
      .in('lead_id', leadIds)
      .eq('event_type', 'opened')
      .order('created_at', { ascending: false });

    if (error || !events) {
      return historyMap;
    }

    // Group by lead_id
    for (const event of events) {
      const date = new Date(event.created_at);
      const history: LeadOpenHistory = {
        openedAt: date,
        dayOfWeek: date.getDay(),
        hourOfDay: date.getHours(),
      };

      if (!historyMap.has(event.lead_id)) {
        historyMap.set(event.lead_id, []);
      }
      historyMap.get(event.lead_id)!.push(history);
    }

    // Limit to 20 per lead
    for (const [leadId, history] of historyMap) {
      if (history.length > 20) {
        historyMap.set(leadId, history.slice(0, 20));
      }
    }

    return historyMap;
  }

  /**
   * Calculate optimal send time for a single lead
   */
  async calculateSendTime(lead: Lead): Promise<OptimalSendTime> {
    const openHistory = await this.getLeadOpenHistory(lead.id);
    
    return calculateOptimalSendTime(
      {
        email: lead.email,
        timezone: lead.timezone || undefined,
        country: lead.country || undefined,
        city: lead.city || undefined,
      },
      openHistory,
      { ...DEFAULT_CONFIG, ...this.config }
    );
  }

  /**
   * Calculate optimal send times for multiple leads in batch
   */
  async calculateBatchSendTimes(leads: Lead[]): Promise<Map<string, OptimalSendTime>> {
    const leadIds = leads.map((l) => l.id);
    const openHistoryMap = await this.getBatchOpenHistory(leadIds);

    return calculateBatchSendTimes(
      leads.map((l) => ({
        id: l.id,
        email: l.email,
        timezone: l.timezone || undefined,
        country: l.country || undefined,
        city: l.city || undefined,
      })),
      openHistoryMap,
      { ...DEFAULT_CONFIG, ...this.config }
    );
  }

  /**
   * Schedule an email with optimal timing
   */
  async scheduleEmail(
    emailId: string,
    leadId: string,
    campaignId: string,
    inboxId: string,
    sequenceStep: number,
    lead: Lead
  ): Promise<{ scheduled: boolean; scheduledAt: Date; timezone: string; confidence: string }> {
    // Calculate optimal send time
    const optimal = await this.calculateSendTime(lead);

    const job: ScheduleEmailJob = {
      emailId,
      leadId,
      campaignId,
      inboxId,
      sequenceStep,
      scheduledAt: optimal.scheduledAt,
      timezone: optimal.timezone,
      optimizationApplied: optimal.confidence !== 'low',
    };

    // Calculate delay from now
    const delay = Math.max(0, optimal.scheduledAt.getTime() - Date.now());
    const today = new Date().toISOString().split('T')[0];
    const jobId = `smart-${campaignId}-${leadId}-${sequenceStep}-${today}`;

    try {
      await this.emailQueue.add('send-optimized-email', job, {
        delay,
        jobId,
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      // Update email record with scheduled time
      await this.supabase
        .from('emails')
        .update({
          scheduled_for: optimal.scheduledAt.toISOString(),
        })
        .eq('id', emailId);

      return {
        scheduled: true,
        scheduledAt: optimal.scheduledAt,
        timezone: optimal.timezone,
        confidence: optimal.confidence,
      };
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        return {
          scheduled: false,
          scheduledAt: optimal.scheduledAt,
          timezone: optimal.timezone,
          confidence: optimal.confidence,
        };
      }
      throw error;
    }
  }

  /**
   * Schedule multiple emails with optimal timing
   */
  async scheduleBatch(
    emails: Array<{
      emailId: string;
      leadId: string;
      campaignId: string;
      inboxId: string;
      sequenceStep: number;
      lead: Lead;
    }>
  ): Promise<Array<{ emailId: string; scheduled: boolean; scheduledAt: Date; timezone: string }>> {
    // Get batch optimal times
    const leads = emails.map((e) => e.lead);
    const optimalTimes = await this.calculateBatchSendTimes(leads);

    const results: Array<{ emailId: string; scheduled: boolean; scheduledAt: Date; timezone: string }> = [];

    for (const email of emails) {
      const optimal = optimalTimes.get(email.lead.id);
      if (!optimal) {
        results.push({
          emailId: email.emailId,
          scheduled: false,
          scheduledAt: new Date(),
          timezone: 'UTC',
        });
        continue;
      }

      try {
        const result = await this.scheduleEmail(
          email.emailId,
          email.leadId,
          email.campaignId,
          email.inboxId,
          email.sequenceStep,
          email.lead
        );
        results.push({
          emailId: email.emailId,
          ...result,
        });
      } catch (error) {
        results.push({
          emailId: email.emailId,
          scheduled: false,
          scheduledAt: optimal.scheduledAt,
          timezone: optimal.timezone,
        });
      }
    }

    return results;
  }

  /**
   * Check if now is a good time to send to a lead
   */
  async isGoodTimeToSend(lead: Lead): Promise<boolean> {
    const timezone = lead.timezone || 
      inferTimezoneFromLocation(lead.country || undefined, lead.city || undefined) ||
      inferTimezoneFromEmail(lead.email) ||
      'America/New_York';

    return isWithinOptimalWindow(timezone, 9, 17);
  }

  /**
   * Get timezone for a lead
   */
  getLeadTimezone(lead: Lead): string {
    return (
      lead.timezone ||
      inferTimezoneFromLocation(lead.country || undefined, lead.city || undefined) ||
      inferTimezoneFromEmail(lead.email) ||
      'America/New_York'
    );
  }

  /**
   * Update a lead's inferred timezone based on their email
   */
  async updateLeadTimezone(leadId: string, email: string): Promise<void> {
    const inferred = inferTimezoneFromEmail(email);
    if (inferred) {
      await this.supabase
        .from('leads')
        .update({ timezone: inferred })
        .eq('id', leadId)
        .is('timezone', null); // Only update if not already set
    }
  }

  /**
   * Get send time analytics for a campaign
   */
  async getSendTimeAnalytics(campaignId: string): Promise<{
    totalEmails: number;
    byTimezone: Record<string, number>;
    byDayOfWeek: Record<string, number>;
    byHour: Record<string, number>;
    averageOpenRate: number;
  }> {
    // Get all emails for this campaign with their events
    const { data: emails, error } = await this.supabase
      .from('emails')
      .select(`
        id,
        sent_at,
        open_count,
        leads(timezone)
      `)
      .eq('campaign_id', campaignId)
      .not('sent_at', 'is', null);

    if (error || !emails) {
      return {
        totalEmails: 0,
        byTimezone: {},
        byDayOfWeek: {},
        byHour: {},
        averageOpenRate: 0,
      };
    }

    const byTimezone: Record<string, number> = {};
    const byDayOfWeek: Record<string, number> = {};
    const byHour: Record<string, number> = {};
    let totalOpens = 0;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (const email of emails) {
      if (!email.sent_at) continue;

      const sentDate = new Date(email.sent_at);
      const timezone = (email.leads as any)?.timezone || 'Unknown';
      const day = dayNames[sentDate.getDay()];
      const hour = sentDate.getHours().toString().padStart(2, '0') + ':00';

      byTimezone[timezone] = (byTimezone[timezone] || 0) + 1;
      byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;
      byHour[hour] = (byHour[hour] || 0) + 1;

      if ((email.open_count ?? 0) > 0) {
        totalOpens++;
      }
    }

    return {
      totalEmails: emails.length,
      byTimezone,
      byDayOfWeek,
      byHour,
      averageOpenRate: emails.length > 0 ? totalOpens / emails.length : 0,
    };
  }

  async close() {
    await this.emailQueue.close();
  }
}

export default SmartScheduler;
