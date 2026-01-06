import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

@Injectable()
export class CampaignsService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async getCampaigns(teamId: string) {
    const { data, error } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getCampaign(campaignId: string, teamId: string) {
    const { data, error } = await this.supabase
      .from('campaigns')
      .select('*, sequences(*), campaign_inboxes(inbox_id, inboxes(*))')
      .eq('id', campaignId)
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Campaign not found');
    }

    return data;
  }

  async createCampaign(teamId: string, input: {
    name: string;
    lead_list_id?: string;
    settings?: Record<string, unknown>;
  }) {
    const { data, error } = await this.supabase
      .from('campaigns')
      .insert({
        team_id: teamId,
        name: input.name,
        lead_list_id: input.lead_list_id,
        status: 'draft',
        settings: input.settings ?? {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCampaign(campaignId: string, teamId: string, input: Partial<{
    name: string;
    settings: Record<string, unknown>;
  }>) {
    await this.getCampaign(campaignId, teamId);

    const { data, error } = await this.supabase
      .from('campaigns')
      .update(input)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async startCampaign(campaignId: string, teamId: string) {
    await this.getCampaign(campaignId, teamId);

    const { data, error } = await this.supabase
      .from('campaigns')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async pauseCampaign(campaignId: string, teamId: string) {
    await this.getCampaign(campaignId, teamId);

    const { data, error } = await this.supabase
      .from('campaigns')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCampaign(campaignId: string, teamId: string) {
    await this.getCampaign(campaignId, teamId);

    const { error } = await this.supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) throw error;
    return { success: true };
  }
}
