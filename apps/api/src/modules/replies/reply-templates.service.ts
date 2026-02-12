import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { processEmailContent } from '@aninda/shared';

export interface CreateReplyTemplateDto {
  name: string;
  content: string;
  intent_type?: string;
  shortcut_number?: number;
  is_default?: boolean;
}

export interface UpdateReplyTemplateDto {
  name?: string;
  content?: string;
  intent_type?: string | null;
  shortcut_number?: number | null;
  is_default?: boolean;
}

export interface ReplyTemplate {
  id: string;
  team_id: string;
  name: string;
  content: string;
  intent_type: string | null;
  shortcut_number: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ReplyTemplatesService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Get all reply templates for a team
   */
  async getTemplates(teamId: string): Promise<ReplyTemplate[]> {
    const { data, error } = await this.supabase
      .from('reply_templates')
      .select('*')
      .eq('team_id', teamId)
      .order('shortcut_number', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: string, teamId: string): Promise<ReplyTemplate> {
    const { data, error } = await this.supabase
      .from('reply_templates')
      .select('*')
      .eq('id', templateId)
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Template not found');
    }

    return data;
  }

  /**
   * Get template by shortcut number
   */
  async getTemplateByShortcut(teamId: string, shortcutNumber: number): Promise<ReplyTemplate | null> {
    const { data, error } = await this.supabase
      .from('reply_templates')
      .select('*')
      .eq('team_id', teamId)
      .eq('shortcut_number', shortcutNumber)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get default template for an intent type
   */
  async getDefaultTemplateForIntent(teamId: string, intentType: string): Promise<ReplyTemplate | null> {
    const { data, error } = await this.supabase
      .from('reply_templates')
      .select('*')
      .eq('team_id', teamId)
      .eq('intent_type', intentType)
      .eq('is_default', true)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Create a new reply template
   */
  async createTemplate(teamId: string, dto: CreateReplyTemplateDto): Promise<ReplyTemplate> {
    // Validate shortcut number if provided
    if (dto.shortcut_number !== undefined) {
      if (dto.shortcut_number < 1 || dto.shortcut_number > 9) {
        throw new BadRequestException('Shortcut number must be between 1 and 9');
      }

      // Check if shortcut already exists
      const existing = await this.getTemplateByShortcut(teamId, dto.shortcut_number);
      if (existing) {
        throw new BadRequestException(`Shortcut ${dto.shortcut_number} is already assigned to template "${existing.name}"`);
      }
    }

    // If this is set as default for an intent, unset other defaults
    if (dto.is_default && dto.intent_type) {
      await this.supabase
        .from('reply_templates')
        .update({ is_default: false })
        .eq('team_id', teamId)
        .eq('intent_type', dto.intent_type)
        .eq('is_default', true);
    }

    const { data, error } = await this.supabase
      .from('reply_templates')
      .insert({
        team_id: teamId,
        name: dto.name,
        content: dto.content,
        intent_type: dto.intent_type || null,
        shortcut_number: dto.shortcut_number || null,
        is_default: dto.is_default || false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(templateId: string, teamId: string, dto: UpdateReplyTemplateDto): Promise<ReplyTemplate> {
    // Verify template exists
    const existing = await this.getTemplate(templateId, teamId);

    // Validate shortcut number if being updated
    if (dto.shortcut_number !== undefined && dto.shortcut_number !== null) {
      if (dto.shortcut_number < 1 || dto.shortcut_number > 9) {
        throw new BadRequestException('Shortcut number must be between 1 and 9');
      }

      // Check if shortcut already exists (excluding current template)
      const shortcutTemplate = await this.getTemplateByShortcut(teamId, dto.shortcut_number);
      if (shortcutTemplate && shortcutTemplate.id !== templateId) {
        throw new BadRequestException(`Shortcut ${dto.shortcut_number} is already assigned to template "${shortcutTemplate.name}"`);
      }
    }

    // If setting as default for an intent, unset other defaults
    if (dto.is_default && (dto.intent_type || existing.intent_type)) {
      const intentType = dto.intent_type ?? existing.intent_type;
      await this.supabase
        .from('reply_templates')
        .update({ is_default: false })
        .eq('team_id', teamId)
        .eq('intent_type', intentType)
        .eq('is_default', true)
        .neq('id', templateId);
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.intent_type !== undefined) updateData.intent_type = dto.intent_type;
    if (dto.shortcut_number !== undefined) updateData.shortcut_number = dto.shortcut_number;
    if (dto.is_default !== undefined) updateData.is_default = dto.is_default;

    const { data, error } = await this.supabase
      .from('reply_templates')
      .update(updateData)
      .eq('id', templateId)
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, teamId: string): Promise<void> {
    // Verify template exists
    await this.getTemplate(templateId, teamId);

    const { error } = await this.supabase
      .from('reply_templates')
      .delete()
      .eq('id', templateId)
      .eq('team_id', teamId);

    if (error) throw error;
  }

  /**
   * Process template content with lead variables and inbox variables
   */
  processTemplateVariables(
    content: string,
    lead: {
      first_name?: string;
      last_name?: string;
      company?: string;
      email?: string;
      title?: string;
      phone?: string;
    },
    originalSubject?: string,
    inbox?: {
      from_name?: string;
      email?: string;
      sender_first_name?: string;
      sender_last_name?: string;
      sender_company?: string;
      sender_title?: string;
      sender_phone?: string;
      sender_website?: string;
    },
  ): string {
    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();

    const variables: Record<string, string> = {
      // Lead variables (both formats)
      firstName: lead.first_name || '',
      lastName: lead.last_name || '',
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      company: lead.company || '',
      email: lead.email || '',
      title: lead.title || '',
      phone: lead.phone || '',
      fullName,
      full_name: fullName,
      originalSubject: originalSubject || '',
    };

    // Inbox variables (both formats)
    if (inbox) {
      variables.from_name = inbox.from_name || '';
      variables.fromName = inbox.from_name || '';
      variables.from_email = inbox.email || '';
      variables.fromEmail = inbox.email || '';
      variables.senderFirstName = inbox.sender_first_name || '';
      variables.sender_first_name = inbox.sender_first_name || '';
      variables.senderLastName = inbox.sender_last_name || '';
      variables.sender_last_name = inbox.sender_last_name || '';
      variables.senderCompany = inbox.sender_company || '';
      variables.sender_company = inbox.sender_company || '';
      variables.senderTitle = inbox.sender_title || '';
      variables.sender_title = inbox.sender_title || '';
      variables.senderPhone = inbox.sender_phone || '';
      variables.sender_phone = inbox.sender_phone || '';
      variables.senderWebsite = inbox.sender_website || '';
      variables.sender_website = inbox.sender_website || '';
    }

    return processEmailContent(content, variables).trim();
  }

  /**
   * Create default templates for a new team
   */
  async createDefaultTemplates(teamId: string): Promise<void> {
    const defaultTemplates: CreateReplyTemplateDto[] = [
      {
        name: 'Interested - Schedule Call',
        content: `Hi {{firstName}},

Thanks for your interest! I'd love to schedule a quick call to discuss how we can help.

Would any of these times work for you this week?
- [Time option 1]
- [Time option 2]
- [Time option 3]

Looking forward to connecting!`,
        intent_type: 'interested',
        shortcut_number: 1,
        is_default: true,
      },
      {
        name: 'Question - Provide Info',
        content: `Hi {{firstName}},

Great question! Here's some more information:

[Answer their specific question]

Let me know if you have any other questions or if you'd like to hop on a quick call to discuss further.`,
        intent_type: 'question',
        shortcut_number: 2,
        is_default: true,
      },
      {
        name: 'Follow Up - Gentle Nudge',
        content: `Hi {{firstName}},

Just wanted to follow up on my previous email. I understand you're busy, so I'll keep this brief.

Would you have 15 minutes this week for a quick chat?

No worries if now isn't the right time - just let me know.`,
        intent_type: undefined,
        shortcut_number: 3,
        is_default: false,
      },
    ];

    for (const template of defaultTemplates) {
      try {
        await this.createTemplate(teamId, template);
      } catch {
        // Ignore errors for default template creation
      }
    }
  }
}
