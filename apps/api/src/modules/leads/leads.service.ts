import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { randomUUID } from 'crypto';
import {
  verifyEmail,
  verifyEmailBatch,
  quickValidate,
  leadStateMachine,
  type EmailVerificationResult,
  type LeadStatus,
} from '@aninda/shared';

// Environment-based configuration for email verification
const EMAIL_VERIFICATION_ENABLED = process.env.EMAIL_VERIFICATION_ENABLED !== 'false';
const EMAIL_VERIFICATION_SKIP_NETWORK = process.env.EMAIL_VERIFICATION_SKIP_NETWORK === 'true';

export interface CreateLeadInput {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedin_url?: string;
  website?: string;
  timezone?: string;
  country?: string;
  city?: string;
  analysis_notes?: string;
  custom_fields?: Record<string, unknown>;
}

interface CreateLeadListInput {
  name: string;
  description?: string;
  source?: string;
}

interface ImportLeadsInput {
  lead_list_id?: string;
  leads: CreateLeadInput[];
}

@Injectable()
export class LeadsService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  // ============================================
  // Lead Lists
  // ============================================

  async getLeadLists(teamId: string) {
    const { data, error } = await this.supabase
      .from('lead_lists')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getLeadList(listId: string, teamId: string) {
    const { data, error } = await this.supabase
      .from('lead_lists')
      .select('*')
      .eq('id', listId)
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Lead list not found');
    }

    return data;
  }

  async createLeadList(teamId: string, input: CreateLeadListInput) {
    const { data, error } = await this.supabase
      .from('lead_lists')
      .insert({
        team_id: teamId,
        name: input.name,
        description: input.description,
        source: input.source,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateLeadList(listId: string, teamId: string, input: Partial<CreateLeadListInput>) {
    await this.getLeadList(listId, teamId);

    const { data, error } = await this.supabase
      .from('lead_lists')
      .update(input)
      .eq('id', listId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteLeadList(listId: string, teamId: string) {
    await this.getLeadList(listId, teamId);

    // Delete all leads in the list first
    await this.supabase
      .from('leads')
      .delete()
      .eq('lead_list_id', listId);

    const { error } = await this.supabase
      .from('lead_lists')
      .delete()
      .eq('id', listId);

    if (error) throw error;
    return { success: true };
  }

  // ============================================
  // Leads
  // ============================================

  async getLeads(
    teamId: string,
    options?: {
      lead_list_id?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    let query = this.supabase
      .from('leads')
      .select('*, lead_lists(name)', { count: 'exact' })
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (options?.lead_list_id) {
      query = query.eq('lead_list_id', options.lead_list_id);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      query = query.or(
        `email.ilike.%${options.search}%,first_name.ilike.%${options.search}%,last_name.ilike.%${options.search}%,company.ilike.%${options.search}%`,
      );
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { data, count };
  }

  async getLead(leadId: string, teamId: string) {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*, lead_lists(name)')
      .eq('id', leadId)
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Lead not found');
    }

    return data;
  }

  /**
   * Manually verify a lead's email address
   * Updates the lead record with verification results
   */
  async verifyLeadEmail(leadId: string, teamId: string): Promise<{
    email: string;
    verification: EmailVerificationResult;
    updated: boolean;
  }> {
    const lead = await this.getLead(leadId, teamId);

    // Perform verification
    const verification = await verifyEmail(lead.email, {
      skipSmtp: EMAIL_VERIFICATION_SKIP_NETWORK,
      skipCatchAll: EMAIL_VERIFICATION_SKIP_NETWORK,
    });

    // Update lead record with verification results
    const { error } = await this.supabase
      .from('leads')
      .update({
        email_verification_status: verification.status,
        email_risk_score: verification.riskScore,
        email_verified_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    return {
      email: lead.email,
      verification,
      updated: !error,
    };
  }

  async createLead(teamId: string, input: CreateLeadInput & { lead_list_id?: string; skip_verification?: boolean }) {
    // Validate email syntax first (quick check)
    if (!input.email || !this.isValidEmail(input.email)) {
      throw new BadRequestException('Invalid email address');
    }

    // Check for duplicates
    const { data: existing } = await this.supabase
      .from('leads')
      .select('id')
      .eq('team_id', teamId)
      .eq('email', input.email.toLowerCase())
      .single();

    if (existing) {
      throw new BadRequestException('Lead with this email already exists');
    }

    // Email verification (if enabled and not skipped)
    let verificationResult: EmailVerificationResult | null = null;
    if (EMAIL_VERIFICATION_ENABLED && !input.skip_verification) {
      try {
        verificationResult = await verifyEmail(input.email, {
          skipSmtp: EMAIL_VERIFICATION_SKIP_NETWORK,
          skipCatchAll: EMAIL_VERIFICATION_SKIP_NETWORK,
        });

        // Reject clearly invalid emails
        if (verificationResult.status === 'invalid') {
          throw new BadRequestException(
            `Invalid email address: ${verificationResult.details || 'Email verification failed'}`
          );
        }
      } catch (error) {
        // If verification fails but email passes syntax check, log and continue
        if (error instanceof BadRequestException) {
          throw error;
        }
        console.warn('Email verification failed, proceeding with unverified email:', error);
      }
    }

    const { data, error } = await this.supabase
      .from('leads')
      .insert({
        team_id: teamId,
        lead_list_id: input.lead_list_id,
        email: input.email.toLowerCase(),
        first_name: input.first_name,
        last_name: input.last_name,
        company: input.company,
        title: input.title,
        phone: input.phone,
        linkedin_url: input.linkedin_url,
        website: input.website,
        timezone: input.timezone,
        country: input.country,
        city: input.city,
        custom_fields: input.custom_fields ?? {},
        status: 'pending',
        unsubscribe_token: randomUUID(),
        // Add verification fields
        email_verification_status: verificationResult?.status ?? 'unverified',
        email_risk_score: verificationResult?.riskScore ?? null,
        email_verified_at: verificationResult ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update lead count in list
    if (input.lead_list_id) {
      await this.updateLeadListCount(input.lead_list_id);
    }

    return data;
  }

  async updateLead(leadId: string, teamId: string, input: Partial<CreateLeadInput>) {
    await this.getLead(leadId, teamId);

    const { data, error } = await this.supabase
      .from('leads')
      .update({
        ...input,
        email: input.email?.toLowerCase(),
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteLead(leadId: string, teamId: string) {
    const lead = await this.getLead(leadId, teamId);

    const { error } = await this.supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) throw error;

    // Update lead count in list
    if (lead.lead_list_id) {
      await this.updateLeadListCount(lead.lead_list_id);
    }

    return { success: true };
  }

  async bulkDeleteLeads(leadIds: string[], teamId: string) {
    // Get lead list IDs for count update
    const { data: leads } = await this.supabase
      .from('leads')
      .select('lead_list_id')
      .eq('team_id', teamId)
      .in('id', leadIds);

    const { error } = await this.supabase
      .from('leads')
      .delete()
      .eq('team_id', teamId)
      .in('id', leadIds);

    if (error) throw error;

    // Update lead counts
    const listIds = [...new Set(leads?.map((l) => l.lead_list_id).filter(Boolean))];
    for (const listId of listIds) {
      if (listId) {
        await this.updateLeadListCount(listId);
      }
    }

    return { success: true, deleted: leadIds.length };
  }

  // ============================================
  // Import
  // ============================================

  async importLeads(teamId: string, input: ImportLeadsInput & { skip_verification?: boolean }) {
    const results = {
      imported: 0,
      duplicates: 0,
      invalid: 0,
      risky: 0,
      errors: [] as string[],
    };

    // Get existing emails for duplicate checking
    const { data: existingLeads } = await this.supabase
      .from('leads')
      .select('email')
      .eq('team_id', teamId);

    const existingEmails = new Set(existingLeads?.map((l) => l.email.toLowerCase()) ?? []);

    // First pass: filter valid emails and remove duplicates
    const emailsToVerify: string[] = [];
    const validLeads: (CreateLeadInput & { email: string })[] = [];

    for (const lead of input.leads) {
      // Quick syntax validation
      const validation = quickValidate(lead.email);
      if (!validation.valid) {
        results.invalid++;
        results.errors.push(`Invalid email syntax: ${lead.email}`);
        continue;
      }

      const email = lead.email.toLowerCase();

      // Check for duplicates
      if (existingEmails.has(email)) {
        results.duplicates++;
        continue;
      }

      // Add to existing set to catch duplicates within the import
      existingEmails.add(email);
      emailsToVerify.push(email);
      validLeads.push({ ...lead, email });
    }

    // Batch verify emails if verification is enabled
    const verificationResults = new Map<string, EmailVerificationResult>();
    if (EMAIL_VERIFICATION_ENABLED && !input.skip_verification && emailsToVerify.length > 0) {
      try {
        const batchResults = await verifyEmailBatch(emailsToVerify, {
          concurrency: 5,
          skipSmtp: EMAIL_VERIFICATION_SKIP_NETWORK,
          skipCatchAll: EMAIL_VERIFICATION_SKIP_NETWORK,
        });

        for (const result of batchResults) {
          verificationResults.set(result.email.toLowerCase(), result);
        }
      } catch (error) {
        console.warn('Batch email verification failed, proceeding without verification:', error);
      }
    }

    // Build leads to insert, filtering out invalid emails
    const leadsToInsert = [];

    for (const lead of validLeads) {
      const email = lead.email.toLowerCase();
      const verification = verificationResults.get(email);

      // Skip clearly invalid emails (but allow risky/catch-all)
      if (verification?.status === 'invalid') {
        results.invalid++;
        results.errors.push(`Invalid email (${verification.details || 'failed verification'}): ${email}`);
        continue;
      }

      // Track risky emails (but still import them)
      if (verification?.status === 'risky' || verification?.status === 'catch_all') {
        results.risky++;
      }

      leadsToInsert.push({
        team_id: teamId,
        lead_list_id: input.lead_list_id,
        email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company,
        title: lead.title,
        phone: lead.phone,
        linkedin_url: lead.linkedin_url,
        website: lead.website,
        timezone: lead.timezone,
        country: lead.country,
        city: lead.city,
        custom_fields: lead.custom_fields ?? {},
        status: 'pending',
        unsubscribe_token: randomUUID(),
        // Add verification fields
        email_verification_status: verification?.status ?? 'unverified',
        email_risk_score: verification?.riskScore ?? null,
        email_verified_at: verification ? new Date().toISOString() : null,
      });
    }

    // Batch insert
    if (leadsToInsert.length > 0) {
      const { error } = await this.supabase
        .from('leads')
        .insert(leadsToInsert);

      if (error) {
        throw error;
      }

      results.imported = leadsToInsert.length;

      // Update lead count in list
      if (input.lead_list_id) {
        await this.updateLeadListCount(input.lead_list_id);
      }
    }

    return results;
  }

  async parseCSV(csvContent: string): Promise<CreateLeadInput[]> {
    const lines = csvContent.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      throw new BadRequestException('CSV must have headers and at least one row');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
    const leads: CreateLeadInput[] = [];

    // Map common header variations
    const headerMap: Record<string, keyof CreateLeadInput> = {
      email: 'email',
      'email address': 'email',
      'e-mail': 'email',
      first_name: 'first_name',
      'first name': 'first_name',
      firstname: 'first_name',
      last_name: 'last_name',
      'last name': 'last_name',
      lastname: 'last_name',
      company: 'company',
      'company name': 'company',
      organization: 'company',
      title: 'title',
      'job title': 'title',
      position: 'title',
      phone: 'phone',
      'phone number': 'phone',
      telephone: 'phone',
      linkedin: 'linkedin_url',
      linkedin_url: 'linkedin_url',
      'linkedin url': 'linkedin_url',
      website: 'website',
      url: 'website',
      timezone: 'timezone',
      country: 'country',
      city: 'city',
    };

    // Find column indices
    const columnMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      if (headerMap[normalizedHeader]) {
        columnMap[headerMap[normalizedHeader]] = index;
      }
    });

    if (columnMap.email === undefined) {
      throw new BadRequestException('CSV must have an email column');
    }

    // Parse rows
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const lead: CreateLeadInput = {
        email: values[columnMap.email] || '',
        first_name: columnMap.first_name !== undefined ? values[columnMap.first_name] : undefined,
        last_name: columnMap.last_name !== undefined ? values[columnMap.last_name] : undefined,
        company: columnMap.company !== undefined ? values[columnMap.company] : undefined,
        title: columnMap.title !== undefined ? values[columnMap.title] : undefined,
        phone: columnMap.phone !== undefined ? values[columnMap.phone] : undefined,
        linkedin_url: columnMap.linkedin_url !== undefined ? values[columnMap.linkedin_url] : undefined,
        website: columnMap.website !== undefined ? values[columnMap.website] : undefined,
        timezone: columnMap.timezone !== undefined ? values[columnMap.timezone] : undefined,
        country: columnMap.country !== undefined ? values[columnMap.country] : undefined,
        city: columnMap.city !== undefined ? values[columnMap.city] : undefined,
      };

      // Collect remaining columns as custom fields
      const customFields: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (!Object.values(columnMap).includes(index) && values[index]) {
          customFields[header] = values[index];
        }
      });

      if (Object.keys(customFields).length > 0) {
        lead.custom_fields = customFields;
      }

      if (lead.email) {
        leads.push(lead);
      }
    }

    return leads;
  }

  // ============================================
  // Suppression
  // ============================================

  async addToSuppressionList(teamId: string, email: string, reason: string) {
    const { data, error } = await this.supabase
      .from('suppression_list')
      .insert({
        team_id: teamId,
        email: email.toLowerCase(),
        reason,
      })
      .select()
      .single();

    if (error) {
      // Ignore duplicate errors
      if (error.code !== '23505') throw error;
    }

    return data;
  }

  async removeFromSuppressionList(teamId: string, email: string) {
    const { error } = await this.supabase
      .from('suppression_list')
      .delete()
      .eq('team_id', teamId)
      .eq('email', email.toLowerCase());

    if (error) throw error;
    return { success: true };
  }

  async getSuppressionList(teamId: string) {
    const { data, error } = await this.supabase
      .from('suppression_list')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // ============================================
  // Unsubscribe
  // ============================================

  /**
   * Unsubscribe a lead by their unique unsubscribe token
   * This is used by the one-click unsubscribe links in emails (RFC 8058)
   */
  async unsubscribeByToken(token: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!token) {
      throw new BadRequestException('Invalid unsubscribe token');
    }

    // Find the lead by unsubscribe token
    const { data: lead, error } = await this.supabase
      .from('leads')
      .select('id, email, team_id, status')
      .eq('unsubscribe_token', token)
      .single();

    if (error || !lead) {
      // Return success anyway to prevent token enumeration attacks
      // but don't do anything
      return {
        success: true,
        message: 'You have been unsubscribed.',
      };
    }

    // Skip if already unsubscribed
    if (lead.status === 'unsubscribed') {
      return {
        success: true,
        message: 'You have been unsubscribed.',
      };
    }

    // Use state machine to validate the transition
    const newStatus = leadStateMachine.canTransition(lead.status as LeadStatus, 'UNSUBSCRIBE');
    if (!newStatus) {
      // Log the warning but still unsubscribe for compliance
      console.warn(`State machine blocked unsubscribe transition from ${lead.status}, forcing unsubscribe for compliance`);
    }

    // Update lead status to unsubscribed
    await this.supabase
      .from('leads')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    // Add to suppression list
    await this.supabase
      .from('suppression_list')
      .upsert(
        {
          team_id: lead.team_id,
          email: lead.email.toLowerCase(),
          reason: 'unsubscribed',
        },
        {
          onConflict: 'team_id,email',
          ignoreDuplicates: true,
        }
      );

    // Log the unsubscribe event
    try {
      await this.supabase
        .from('email_events')
        .insert({
          team_id: lead.team_id,
          lead_id: lead.id,
          event_type: 'unsubscribed',
        });
    } catch {
      // email_events table might not have lead_id column, ignore
    }

    return {
      success: true,
      message: 'You have been unsubscribed.',
    };
  }

  // ============================================
  // GDPR Compliance
  // ============================================

  /**
   * GDPR Right to Erasure (Article 17)
   * Deletes all personal data associated with an email address across all teams
   * Returns a deletion report for compliance documentation
   */
  async gdprDeleteByEmail(email: string): Promise<{
    success: boolean;
    email: string;
    deletedAt: string;
    deletionReport: {
      leads: number;
      emails: number;
      replies: number;
      events: number;
      suppressionEntries: number;
    };
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    if (!this.isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Invalid email address');
    }

    const deletionReport = {
      leads: 0,
      emails: 0,
      replies: 0,
      events: 0,
      suppressionEntries: 0,
    };

    // 1. Find all leads with this email
    const { data: leads } = await this.supabase
      .from('leads')
      .select('id, team_id')
      .eq('email', normalizedEmail);

    const leadIds = leads?.map(l => l.id) ?? [];

    if (leadIds.length > 0) {
      // 2. Delete all email_events for these leads' emails
      const { data: emailRecords } = await this.supabase
        .from('emails')
        .select('id')
        .in('lead_id', leadIds);

      const emailIds = emailRecords?.map(e => e.id) ?? [];

      if (emailIds.length > 0) {
        // Count events before deleting
        const { count: eventsCount } = await this.supabase
          .from('email_events')
          .select('*', { count: 'exact', head: true })
          .in('email_id', emailIds);

        // Delete events
        await this.supabase
          .from('email_events')
          .delete()
          .in('email_id', emailIds);

        deletionReport.events = eventsCount ?? 0;
      }

      // 3. Count and delete all replies from these leads
      const { count: repliesCount } = await this.supabase
        .from('replies')
        .select('*', { count: 'exact', head: true })
        .in('lead_id', leadIds);

      await this.supabase
        .from('replies')
        .delete()
        .in('lead_id', leadIds);

      deletionReport.replies = repliesCount ?? 0;

      // 4. Count and delete all emails sent to these leads
      const { count: emailsCount } = await this.supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .in('lead_id', leadIds);

      await this.supabase
        .from('emails')
        .delete()
        .in('lead_id', leadIds);

      deletionReport.emails = emailsCount ?? 0;

      // 5. Delete the leads themselves (count = leadIds.length)
      await this.supabase
        .from('leads')
        .delete()
        .eq('email', normalizedEmail);

      deletionReport.leads = leadIds.length;
    }

    // 6. Count and delete from all suppression lists
    const { count: suppressionCount } = await this.supabase
      .from('suppression_list')
      .select('*', { count: 'exact', head: true })
      .eq('email', normalizedEmail);

    await this.supabase
      .from('suppression_list')
      .delete()
      .eq('email', normalizedEmail);

    deletionReport.suppressionEntries = suppressionCount ?? 0;

    // 7. Log the deletion for GDPR compliance audit trail
    try {
      await this.supabase
        .from('gdpr_deletion_log')
        .insert({
          email_hash: this.hashEmail(normalizedEmail), // Store hash, not actual email
          deleted_at: new Date().toISOString(),
          leads_deleted: deletionReport.leads,
          emails_deleted: deletionReport.emails,
          replies_deleted: deletionReport.replies,
          events_deleted: deletionReport.events,
          suppression_deleted: deletionReport.suppressionEntries,
        });
    } catch {
      // gdpr_deletion_log table may not exist, continue without logging
      console.log('GDPR deletion log table not found, skipping audit log');
    }

    return {
      success: true,
      email: normalizedEmail,
      deletedAt: new Date().toISOString(),
      deletionReport,
    };
  }

  /**
   * GDPR Data Export (Article 20)
   * Exports all personal data for an email address in a portable format
   */
  async gdprExportByEmail(email: string): Promise<{
    email: string;
    exportedAt: string;
    data: {
      leads: any[];
      emails: any[];
      replies: any[];
    };
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    if (!this.isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Invalid email address');
    }

    // Get all leads
    const { data: leads } = await this.supabase
      .from('leads')
      .select('*')
      .eq('email', normalizedEmail);

    const leadIds = leads?.map(l => l.id) ?? [];

    // Get all emails
    const { data: emails } = await this.supabase
      .from('emails')
      .select('*')
      .in('lead_id', leadIds);

    // Get all replies
    const { data: replies } = await this.supabase
      .from('replies')
      .select('*')
      .in('lead_id', leadIds);

    return {
      email: normalizedEmail,
      exportedAt: new Date().toISOString(),
      data: {
        leads: leads ?? [],
        emails: emails ?? [],
        replies: replies ?? [],
      },
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

  private hashEmail(email: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(email).digest('hex');
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  private async updateLeadListCount(listId: string) {
    const { count } = await this.supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_list_id', listId);

    await this.supabase
      .from('lead_lists')
      .update({ lead_count: count ?? 0 })
      .eq('id', listId);
  }
}
