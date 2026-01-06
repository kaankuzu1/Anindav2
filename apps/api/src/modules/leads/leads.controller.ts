import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadsService, CreateLeadInput } from './leads.service';

// Multer file type
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('leads')
@UseGuards(AuthGuard('jwt'))
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // ============================================
  // Lead Lists
  // ============================================

  @Get('lists')
  async getLeadLists(@Query('team_id') teamId: string) {
    return this.leadsService.getLeadLists(teamId);
  }

  @Get('lists/:id')
  async getLeadList(
    @Param('id') listId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.leadsService.getLeadList(listId, teamId);
  }

  @Post('lists')
  async createLeadList(
    @Query('team_id') teamId: string,
    @Body() body: { name: string; description?: string; source?: string },
  ) {
    return this.leadsService.createLeadList(teamId, body);
  }

  @Patch('lists/:id')
  async updateLeadList(
    @Param('id') listId: string,
    @Query('team_id') teamId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.leadsService.updateLeadList(listId, teamId, body);
  }

  @Delete('lists/:id')
  async deleteLeadList(
    @Param('id') listId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.leadsService.deleteLeadList(listId, teamId);
  }

  // ============================================
  // Leads
  // ============================================

  @Get()
  async getLeads(
    @Query('team_id') teamId: string,
    @Query('lead_list_id') leadListId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.leadsService.getLeads(teamId, {
      lead_list_id: leadListId,
      status,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  async getLead(
    @Param('id') leadId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.leadsService.getLead(leadId, teamId);
  }

  @Post()
  async createLead(
    @Query('team_id') teamId: string,
    @Body() body: {
      email: string;
      lead_list_id?: string;
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
      custom_fields?: Record<string, unknown>;
    },
  ) {
    return this.leadsService.createLead(teamId, body);
  }

  @Patch(':id')
  async updateLead(
    @Param('id') leadId: string,
    @Query('team_id') teamId: string,
    @Body() body: {
      email?: string;
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
      custom_fields?: Record<string, unknown>;
    },
  ) {
    return this.leadsService.updateLead(leadId, teamId, body);
  }

  @Delete(':id')
  async deleteLead(
    @Param('id') leadId: string,
    @Query('team_id') teamId: string,
  ) {
    return this.leadsService.deleteLead(leadId, teamId);
  }

  @Post('bulk-delete')
  async bulkDeleteLeads(
    @Query('team_id') teamId: string,
    @Body() body: { lead_ids: string[] },
  ) {
    return this.leadsService.bulkDeleteLeads(body.lead_ids, teamId);
  }

  // ============================================
  // Import
  // ============================================

  @Post('import')
  async importLeads(
    @Query('team_id') teamId: string,
    @Body() body: {
      lead_list_id?: string;
      leads: Array<{
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
        custom_fields?: Record<string, unknown>;
      }>;
    },
  ) {
    return this.leadsService.importLeads(teamId, body);
  }

  @Post('import/csv')
  @UseInterceptors(FileInterceptor('file'))
  async importCSV(
    @Query('team_id') teamId: string,
    @Query('lead_list_id') leadListId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(text\/csv|application\/vnd\.ms-excel)/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: MulterFile,
  ) {
    const csvContent = file.buffer.toString('utf-8');
    const leads = await this.leadsService.parseCSV(csvContent);
    return this.leadsService.importLeads(teamId, {
      lead_list_id: leadListId,
      leads,
    });
  }

  @Post('import/parse-csv')
  @UseInterceptors(FileInterceptor('file'))
  async parseCSV(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(text\/csv|application\/vnd\.ms-excel)/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: MulterFile,
  ): Promise<{ preview: CreateLeadInput[]; total: number; columns: string[] }> {
    const csvContent = file.buffer.toString('utf-8');
    const leads = await this.leadsService.parseCSV(csvContent);
    return {
      preview: leads.slice(0, 10),
      total: leads.length,
      columns: leads.length > 0 ? Object.keys(leads[0]) : [],
    };
  }

  // ============================================
  // Suppression List
  // ============================================

  @Get('suppression')
  async getSuppressionList(@Query('team_id') teamId: string) {
    return this.leadsService.getSuppressionList(teamId);
  }

  @Post('suppression')
  async addToSuppressionList(
    @Query('team_id') teamId: string,
    @Body() body: { email: string; reason: string },
  ) {
    return this.leadsService.addToSuppressionList(teamId, body.email, body.reason);
  }

  @Delete('suppression/:email')
  async removeFromSuppressionList(
    @Param('email') email: string,
    @Query('team_id') teamId: string,
  ) {
    return this.leadsService.removeFromSuppressionList(teamId, email);
  }
}
