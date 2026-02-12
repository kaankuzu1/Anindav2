import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

@Injectable()
export class ABTestService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async getVariantStats(campaignId: string, sequenceId: string) {
    // Verify campaign/sequence relationship
    const { data: sequence } = await this.supabase
      .from('sequences')
      .select('id')
      .eq('id', sequenceId)
      .eq('campaign_id', campaignId)
      .single();

    if (!sequence) throw new NotFoundException('Sequence not found');

    const { data: variants, error } = await this.supabase
      .from('sequence_variants')
      .select('*')
      .eq('sequence_id', sequenceId)
      .order('variant_index', { ascending: true });

    if (error) throw error;

    return (variants || []).map(v => ({
      ...v,
      openRate: v.sent_count > 0 ? Math.round((v.opened_count / v.sent_count) * 1000) / 10 : 0,
      clickRate: v.opened_count > 0 ? Math.round((v.clicked_count / v.opened_count) * 1000) / 10 : 0,
      replyRate: v.sent_count > 0 ? Math.round((v.replied_count / v.sent_count) * 1000) / 10 : 0,
    }));
  }

  async setWinner(campaignId: string, sequenceId: string, variantId: string, teamId: string) {
    // Verify the variant belongs to this sequence
    const { data: variant } = await this.supabase
      .from('sequence_variants')
      .select('id')
      .eq('id', variantId)
      .eq('sequence_id', sequenceId)
      .single();

    if (!variant) throw new NotFoundException('Variant not found');

    // Set winner to 100%
    await this.supabase
      .from('sequence_variants')
      .update({ weight: 100, is_winner: true, winner_declared_at: new Date().toISOString() })
      .eq('id', variantId);

    // Set losers to 0%
    await this.supabase
      .from('sequence_variants')
      .update({ weight: 0, is_winner: false })
      .eq('sequence_id', sequenceId)
      .neq('id', variantId);

    // Log event
    await this.supabase.from('ab_test_events').insert({
      team_id: teamId,
      campaign_id: campaignId,
      sequence_id: sequenceId,
      event_type: 'manual_override',
      winner_variant_id: variantId,
      metadata: { action: 'manual_winner_selection' },
    });

    return { success: true };
  }

  async resetTest(campaignId: string, sequenceId: string, teamId: string) {
    const { data: variants } = await this.supabase
      .from('sequence_variants')
      .select('id')
      .eq('sequence_id', sequenceId);

    if (!variants || variants.length === 0) throw new NotFoundException('No variants found');

    const baseWeight = Math.floor(100 / variants.length);
    const remainder = 100 - (baseWeight * variants.length);

    // Reset all variants to equal weight, distributing remainder to the first variant
    for (let i = 0; i < variants.length; i++) {
      const weight = i === 0 ? baseWeight + remainder : baseWeight;
      await this.supabase
        .from('sequence_variants')
        .update({ weight, is_winner: false, winner_declared_at: null })
        .eq('id', variants[i].id);
    }

    // Log event
    await this.supabase.from('ab_test_events').insert({
      team_id: teamId,
      campaign_id: campaignId,
      sequence_id: sequenceId,
      event_type: 'test_reset',
      metadata: { base_weight: baseWeight, remainder, variant_count: variants.length },
    });

    return { success: true };
  }

  async updateWeights(campaignId: string, sequenceId: string, weights: { variantId: string; weight: number }[], teamId: string) {
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight !== 100) throw new BadRequestException('Weights must sum to 100');

    for (const w of weights) {
      await this.supabase
        .from('sequence_variants')
        .update({ weight: w.weight })
        .eq('id', w.variantId)
        .eq('sequence_id', sequenceId);
    }

    // Log event
    await this.supabase.from('ab_test_events').insert({
      team_id: teamId,
      campaign_id: campaignId,
      sequence_id: sequenceId,
      event_type: 'weight_adjusted',
      metadata: { weights, source: 'manual' },
    });

    return { success: true };
  }

  async getTestHistory(campaignId: string) {
    const { data, error } = await this.supabase
      .from('ab_test_events')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  }
}
