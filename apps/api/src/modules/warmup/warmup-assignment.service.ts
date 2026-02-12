import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

@Injectable()
export class WarmupAssignmentService {
  private readonly logger = new Logger(WarmupAssignmentService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async assignAdminInbox(userInboxId: string): Promise<{ adminInboxId: string; adminEmail: string }> {
    // Find active admin inbox with lowest load under max_capacity
    const { data: adminInboxes, error } = await this.supabase
      .from('admin_inboxes')
      .select('id, email, current_load, max_capacity')
      .eq('status', 'active')
      .order('current_load', { ascending: true });

    if (error) throw error;

    // Find one with available capacity
    const available = (adminInboxes ?? []).find(ai => ai.current_load < ai.max_capacity);

    if (!available) {
      throw new BadRequestException(
        'No admin inboxes available for Network warmup. All are at capacity. Please try again later or use Pool mode.'
      );
    }

    // Create assignment
    const { error: assignError } = await this.supabase
      .from('admin_inbox_assignments')
      .insert({
        inbox_id: userInboxId,
        admin_inbox_id: available.id,
      });

    if (assignError) {
      // Check if already assigned (UNIQUE constraint)
      if (assignError.code === '23505') {
        this.logger.warn(`Inbox ${userInboxId} already assigned to admin inbox ${available.id}`);
        return { adminInboxId: available.id, adminEmail: available.email };
      }
      throw assignError;
    }

    // Increment current_load
    await this.supabase
      .from('admin_inboxes')
      .update({ current_load: available.current_load + 1 })
      .eq('id', available.id);

    this.logger.log(`Assigned admin inbox ${available.email} to user inbox ${userInboxId}`);
    return { adminInboxId: available.id, adminEmail: available.email };
  }

  async releaseAdminInbox(userInboxId: string): Promise<void> {
    // Get current assignments
    const { data: assignments, error } = await this.supabase
      .from('admin_inbox_assignments')
      .select('id, admin_inbox_id')
      .eq('inbox_id', userInboxId);

    if (error) throw error;

    for (const assignment of assignments ?? []) {
      // Delete assignment
      await this.supabase
        .from('admin_inbox_assignments')
        .delete()
        .eq('id', assignment.id);

      // Decrement current_load
      const { data: adminInbox } = await this.supabase
        .from('admin_inboxes')
        .select('current_load')
        .eq('id', assignment.admin_inbox_id)
        .single();

      if (adminInbox) {
        await this.supabase
          .from('admin_inboxes')
          .update({ current_load: Math.max(0, adminInbox.current_load - 1) })
          .eq('id', assignment.admin_inbox_id);
      }
    }

    this.logger.log(`Released all admin inbox assignments for user inbox ${userInboxId}`);
  }

  async getAssignedAdminInboxes(userInboxId: string) {
    const { data, error } = await this.supabase
      .from('admin_inbox_assignments')
      .select('admin_inbox_id, admin_inboxes(id, email, provider, status, health_score)')
      .eq('inbox_id', userInboxId);

    if (error) throw error;
    return (data ?? []).map((a: any) => a.admin_inboxes).filter(Boolean);
  }

  async getAssignedUserInboxes(adminInboxId: string) {
    const { data, error } = await this.supabase
      .from('admin_inbox_assignments')
      .select('inbox_id, inboxes(id, email, provider, status, health_score)')
      .eq('admin_inbox_id', adminInboxId);

    if (error) throw error;
    return (data ?? []).map((a: any) => a.inboxes).filter(Boolean);
  }
}
