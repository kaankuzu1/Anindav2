import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AdminAuthGuard } from '../../shared/guards/admin-auth.guard';
import { AdminService } from './admin.service';
import { AdminInboxesService } from './admin-inboxes.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminInboxesService: AdminInboxesService,
  ) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return this.adminService.login(body.username, body.password);
  }

  @Get('dashboard')
  @UseGuards(AdminAuthGuard)
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('inboxes')
  @UseGuards(AdminAuthGuard)
  async listInboxes() {
    return this.adminInboxesService.listAdminInboxes();
  }

  @Post('inboxes')
  @UseGuards(AdminAuthGuard)
  async createInbox(@Body() body: {
    email: string;
    provider: 'google' | 'microsoft' | 'smtp';
    max_capacity?: number;
    from_name?: string;
    smtp_host?: string;
    smtp_port?: number;
    smtp_secure?: boolean;
    smtp_user?: string;
    smtp_pass?: string;
  }) {
    return this.adminInboxesService.createAdminInbox(body);
  }

  @Get('inboxes/:id')
  @UseGuards(AdminAuthGuard)
  async getInbox(@Param('id') id: string) {
    return this.adminInboxesService.getAdminInbox(id);
  }

  @Patch('inboxes/:id')
  @UseGuards(AdminAuthGuard)
  async updateInbox(
    @Param('id') id: string,
    @Body() body: {
      max_capacity?: number;
      status?: 'active' | 'disabled';
      from_name?: string;
    },
  ) {
    return this.adminInboxesService.updateAdminInbox(id, body);
  }

  @Delete('inboxes/:id')
  @UseGuards(AdminAuthGuard)
  async deleteInbox(@Param('id') id: string) {
    return this.adminInboxesService.deleteAdminInbox(id);
  }

  @Post('inboxes/:id/check-connection')
  @UseGuards(AdminAuthGuard)
  async checkConnection(@Param('id') id: string) {
    return this.adminInboxesService.checkConnection(id);
  }

  // ============================================
  // Assignment Management
  // ============================================

  @Get('inboxes/:id/assignments')
  @UseGuards(AdminAuthGuard)
  async getAssignments(@Param('id') id: string) {
    return this.adminInboxesService.getAssignments(id);
  }

  @Post('inboxes/:id/assignments')
  @UseGuards(AdminAuthGuard)
  async createAssignment(
    @Param('id') id: string,
    @Body() body: { inbox_id: string },
  ) {
    if (!body.inbox_id) {
      throw new BadRequestException('inbox_id is required');
    }
    return this.adminInboxesService.createAssignment(id, body.inbox_id);
  }

  @Delete('inboxes/:id/assignments/:assignmentId')
  @UseGuards(AdminAuthGuard)
  async deleteAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.adminInboxesService.deleteAssignment(id, assignmentId);
  }

  // Frontend-friendly aliases for assignment management
  @Post('inboxes/:id/assign')
  @UseGuards(AdminAuthGuard)
  async assignUserInbox(
    @Param('id') id: string,
    @Body() body: { inbox_id: string },
  ) {
    if (!body.inbox_id) {
      throw new BadRequestException('inbox_id is required');
    }
    return this.adminInboxesService.createAssignment(id, body.inbox_id);
  }

  @Post('inboxes/:id/unassign')
  @UseGuards(AdminAuthGuard)
  async unassignUserInbox(
    @Param('id') id: string,
    @Body() body: { inbox_id: string },
  ) {
    if (!body.inbox_id) {
      throw new BadRequestException('inbox_id is required');
    }
    return this.adminInboxesService.deleteAssignmentByInboxId(id, body.inbox_id);
  }

  // ============================================
  // Stats & History
  // ============================================

  @Get('inboxes/:id/stats')
  @UseGuards(AdminAuthGuard)
  async getInboxStats(@Param('id') id: string) {
    return this.adminInboxesService.getStats(id);
  }

  // ============================================
  // Network Users
  // ============================================

  @Get('users')
  @UseGuards(AdminAuthGuard)
  async listNetworkUsers() {
    return this.adminService.getNetworkUsers();
  }
}
