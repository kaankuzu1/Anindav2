import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';
import { ReplyTemplatesService, CreateReplyTemplateDto, UpdateReplyTemplateDto } from './reply-templates.service';

@Controller('reply-templates')
@UseGuards(SupabaseAuthGuard)
export class ReplyTemplatesController {
  constructor(private readonly templatesService: ReplyTemplatesService) {}

  /**
   * GET /reply-templates
   * List all reply templates for the team
   */
  @Get()
  async getTemplates(@Request() req: any) {
    const teamId = req.user.team_id;
    const templates = await this.templatesService.getTemplates(teamId);
    return { data: templates };
  }

  /**
   * GET /reply-templates/:id
   * Get a specific template
   */
  @Get(':id')
  async getTemplate(@Request() req: any, @Param('id') id: string) {
    const teamId = req.user.team_id;
    const template = await this.templatesService.getTemplate(id, teamId);
    return { data: template };
  }

  /**
   * GET /reply-templates/shortcut/:number
   * Get template by shortcut number
   */
  @Get('shortcut/:number')
  async getTemplateByShortcut(@Request() req: any, @Param('number') number: string) {
    const teamId = req.user.team_id;
    const shortcutNumber = parseInt(number, 10);
    
    if (isNaN(shortcutNumber) || shortcutNumber < 1 || shortcutNumber > 9) {
      return { data: null };
    }

    const template = await this.templatesService.getTemplateByShortcut(teamId, shortcutNumber);
    return { data: template };
  }

  /**
   * GET /reply-templates/intent/:type
   * Get default template for an intent type
   */
  @Get('intent/:type')
  async getDefaultTemplateForIntent(@Request() req: any, @Param('type') intentType: string) {
    const teamId = req.user.team_id;
    const template = await this.templatesService.getDefaultTemplateForIntent(teamId, intentType);
    return { data: template };
  }

  /**
   * POST /reply-templates
   * Create a new reply template
   */
  @Post()
  async createTemplate(@Request() req: any, @Body() dto: CreateReplyTemplateDto) {
    const teamId = req.user.team_id;
    const template = await this.templatesService.createTemplate(teamId, dto);
    return { data: template };
  }

  /**
   * PUT /reply-templates/:id
   * Update an existing template
   */
  @Put(':id')
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateReplyTemplateDto,
  ) {
    const teamId = req.user.team_id;
    const template = await this.templatesService.updateTemplate(id, teamId, dto);
    return { data: template };
  }

  /**
   * DELETE /reply-templates/:id
   * Delete a template
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Request() req: any, @Param('id') id: string) {
    const teamId = req.user.team_id;
    await this.templatesService.deleteTemplate(id, teamId);
  }

  /**
   * POST /reply-templates/:id/process
   * Process a template with lead variables
   */
  @Post(':id/process')
  async processTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      lead: {
        first_name?: string;
        last_name?: string;
        company?: string;
        email?: string;
        title?: string;
        phone?: string;
      };
      originalSubject?: string;
      inbox?: {
        from_name?: string;
        email?: string;
        sender_first_name?: string;
        sender_last_name?: string;
        sender_company?: string;
        sender_title?: string;
        sender_phone?: string;
        sender_website?: string;
      };
    },
  ) {
    const teamId = req.user.team_id;
    const template = await this.templatesService.getTemplate(id, teamId);
    const processedContent = this.templatesService.processTemplateVariables(
      template.content,
      body.lead,
      body.originalSubject,
      body.inbox,
    );
    return { data: { content: processedContent } };
  }

  /**
   * POST /reply-templates/create-defaults
   * Create default templates for the team
   */
  @Post('create-defaults')
  @HttpCode(HttpStatus.CREATED)
  async createDefaultTemplates(@Request() req: any) {
    const teamId = req.user.team_id;
    await this.templatesService.createDefaultTemplates(teamId);
    return { message: 'Default templates created' };
  }
}
