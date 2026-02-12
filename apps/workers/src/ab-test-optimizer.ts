import type { Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';

// Minimum samples per variant needed before any traffic shifting
const MIN_SAMPLES_PER_VARIANT = 50;
// Minimum confidence level (z-score) for statistical significance
const MIN_Z_SCORE = 1.96; // 95% confidence
// Check interval
const OPTIMIZER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface VariantStats {
  variantId: string;
  variantName: string;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  weight: number;
}

interface OptimizationResult {
  campaignId: string;
  sequenceId: string;
  winnerId: string | null;
  winnerName: string | null;
  metric: 'openRate' | 'clickRate' | 'replyRate';
  confidence: number;
  variants: VariantStats[];
  optimized: boolean;
}

export class ABTestOptimizer {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly supabase: SupabaseClient,
  ) {}

  start() {
    console.log('A/B Test Optimizer started');

    // Run immediately on start
    this.optimizeAllCampaigns();

    // Then run every 30 minutes
    this.intervalId = setInterval(() => {
      this.optimizeAllCampaigns();
    }, OPTIMIZER_INTERVAL_MS);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async optimizeAllCampaigns() {
    try {
      console.log('A/B Test Optimizer: Checking campaigns for optimization...');

      // Get all active campaigns with variants
      const { data: campaigns, error } = await this.supabase
        .from('campaigns')
        .select(`
          id,
          name,
          settings,
          sequences(
            id,
            step_number,
            sequence_variants(*)
          )
        `)
        .eq('status', 'active');

      if (error) {
        console.error('Failed to fetch campaigns for A/B optimization:', error);
        return;
      }

      let optimizedCount = 0;

      for (const campaign of campaigns || []) {
        for (const sequence of campaign.sequences || []) {
          const variants = sequence.sequence_variants || [];

          // Skip if no variants or only one variant
          if (variants.length <= 1) continue;

          // Skip if a winner has already been declared (manual or auto)
          const hasWinner = variants.some((v: any) => v.is_winner === true);
          if (hasWinner) continue;

          const result = await this.optimizeSequence(campaign.id, sequence.id, variants, campaign.settings);

          if (result.optimized) {
            optimizedCount++;
            console.log(
              `Campaign "${campaign.name}" Step ${sequence.step_number}: ` +
              (result.winnerId
                ? `Winner declared - "${result.winnerName}" (${result.metric}: ${(result.confidence * 100).toFixed(1)}% confidence)`
                : `Traffic adjusted (${result.metric}: ${(result.confidence * 100).toFixed(1)}% confidence)`)
            );
          }
        }
      }

      if (optimizedCount > 0) {
        console.log(`A/B Test Optimizer: Optimized ${optimizedCount} sequence(s)`);
      }
    } catch (error) {
      console.error('A/B Test Optimizer error:', error);
    }
  }

  private async optimizeSequence(
    campaignId: string,
    sequenceId: string,
    variants: any[],
    settings: any
  ): Promise<OptimizationResult> {
    // Convert snake_case setting to camelCase property name
    const metricMap: Record<string, 'openRate' | 'clickRate' | 'replyRate'> = {
      open_rate: 'openRate',
      click_rate: 'clickRate',
      reply_rate: 'replyRate',
    };
    const settingMetric = settings?.ab_test_metric || 'reply_rate';
    const metric = metricMap[settingMetric] ?? 'replyRate';

    const result: OptimizationResult = {
      campaignId,
      sequenceId,
      winnerId: null,
      winnerName: null,
      metric,
      confidence: 0,
      variants: [],
      optimized: false,
    };

    // Check if any variant already has is_winner set (manual override)
    const hasManualWinner = variants.some((v: any) => v.is_winner === true);
    if (hasManualWinner) return result;

    // Get stats for each variant
    for (const variant of variants) {
      const stats = await this.getVariantStats(variant.id);
      result.variants.push({
        variantId: variant.id,
        variantName: variant.variant_name || `Variant ${variant.variant_index ?? variant.id.slice(0, 8)}`,
        ...stats,
        weight: variant.weight || 50,
      });
    }

    // Sync computed stats to sequence_variants
    for (const variant of result.variants) {
      await this.supabase
        .from('sequence_variants')
        .update({
          sent_count: variant.sentCount,
          opened_count: variant.openedCount,
          clicked_count: variant.clickedCount,
          replied_count: variant.repliedCount,
        })
        .eq('id', variant.variantId);
    }

    // Each variant needs minimum samples before any shifting
    const allHaveMinSamples = result.variants.every(v => v.sentCount >= MIN_SAMPLES_PER_VARIANT);
    if (!allHaveMinSamples) {
      return result;
    }

    // Find the leading variant and confidence level
    const leader = this.findLeader(result.variants, result.metric);

    if (leader) {
      result.winnerId = leader.variantId;
      result.winnerName = leader.variantName;
      result.confidence = leader.confidence;

      // Progressive traffic shifting based on confidence level
      if (leader.confidence >= 0.95) {
        // Declare winner - 100/0 split
        await this.adjustTraffic(sequenceId, leader.variantId, result.variants, 100, true);
        result.optimized = true;
        await this.logOptimizationEvent(campaignId, sequenceId, result, 'winner_declared');
      } else if (leader.confidence >= 0.90) {
        // 85/15 split
        await this.adjustTraffic(sequenceId, leader.variantId, result.variants, 85, false);
        result.optimized = true;
        await this.logOptimizationEvent(campaignId, sequenceId, result, 'weight_adjusted');
      } else if (leader.confidence >= 0.80) {
        // 75/25 split
        await this.adjustTraffic(sequenceId, leader.variantId, result.variants, 75, false);
        result.optimized = true;
        await this.logOptimizationEvent(campaignId, sequenceId, result, 'weight_adjusted');
      } else if (leader.confidence >= 0.70) {
        // 60/40 split
        await this.adjustTraffic(sequenceId, leader.variantId, result.variants, 60, false);
        result.optimized = true;
        await this.logOptimizationEvent(campaignId, sequenceId, result, 'weight_adjusted');
      }
      // Below 70% confidence: no changes
    }

    return result;
  }

  private async getVariantStats(variantId: string): Promise<{
    sentCount: number;
    openedCount: number;
    clickedCount: number;
    repliedCount: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  }> {
    // Get email stats for this variant (include all successfully sent statuses)
    const { data: emails } = await this.supabase
      .from('emails')
      .select('id, status, open_count, click_count')
      .eq('variant_id', variantId)
      .in('status', ['sent', 'delivered', 'opened', 'clicked']);

    const sentCount = emails?.length || 0;
    const openedCount = emails?.filter(e => (e.open_count ?? 0) > 0).length || 0;
    const clickedCount = emails?.filter(e => (e.click_count ?? 0) > 0).length || 0;

    // Get reply count
    const { count: repliedCount } = await this.supabase
      .from('replies')
      .select('id', { count: 'exact', head: true })
      .in('email_id', emails?.map(e => e.id) || []);

    return {
      sentCount,
      openedCount,
      clickedCount,
      repliedCount: repliedCount || 0,
      openRate: sentCount > 0 ? openedCount / sentCount : 0,
      clickRate: openedCount > 0 ? clickedCount / openedCount : 0,
      replyRate: sentCount > 0 ? (repliedCount || 0) / sentCount : 0,
    };
  }

  private findLeader(
    variants: VariantStats[],
    metric: 'openRate' | 'clickRate' | 'replyRate'
  ): { variantId: string; variantName: string; confidence: number } | null {
    if (variants.length < 2) return null;

    // Sort by metric value
    const sorted = [...variants].sort((a, b) => {
      const aValue = a[metric];
      const bValue = b[metric];
      return bValue - aValue;
    });

    const best = sorted[0];
    const secondBest = sorted[1];

    // Calculate z-score for statistical significance
    const zScore = this.calculateZScore(
      best[metric],
      best.sentCount,
      secondBest[metric],
      secondBest.sentCount
    );

    const confidence = this.zScoreToConfidence(zScore);

    // Return leader with confidence if above minimum threshold for shifting (70%)
    if (confidence >= 0.70) {
      return {
        variantId: best.variantId,
        variantName: best.variantName,
        confidence,
      };
    }

    return null;
  }

  /**
   * Calculate z-score for comparing two proportions
   */
  private calculateZScore(p1: number, n1: number, p2: number, n2: number): number {
    if (n1 === 0 || n2 === 0) return 0;

    const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

    if (se === 0) return 0;

    return Math.abs(p1 - p2) / se;
  }

  /**
   * Convert z-score to confidence percentage
   */
  private zScoreToConfidence(zScore: number): number {
    // Approximation of normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(zScore));
    const d = 0.3989423 * Math.exp(-zScore * zScore / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    return zScore > 0 ? 1 - p : p;
  }

  private async adjustTraffic(
    sequenceId: string,
    leaderId: string,
    variants: VariantStats[],
    leaderWeight: number,
    declareWinner: boolean
  ): Promise<void> {
    const loserIds = variants.filter(v => v.variantId !== leaderId).map(v => v.variantId);
    const loserWeight = loserIds.length > 0 ? Math.floor((100 - leaderWeight) / loserIds.length) : 0;

    // Update leader weight (and optionally declare winner)
    const leaderUpdate: Record<string, any> = { weight: leaderWeight };
    if (declareWinner) {
      leaderUpdate.is_winner = true;
      leaderUpdate.winner_declared_at = new Date().toISOString();
    }

    await this.supabase
      .from('sequence_variants')
      .update(leaderUpdate)
      .eq('id', leaderId);

    // Update loser weights
    if (loserIds.length > 0) {
      for (const loserId of loserIds) {
        await this.supabase
          .from('sequence_variants')
          .update({ weight: declareWinner ? 0 : loserWeight })
          .eq('id', loserId);
      }
    }
  }

  private async logOptimizationEvent(
    campaignId: string,
    sequenceId: string,
    result: OptimizationResult,
    eventType: 'winner_declared' | 'weight_adjusted'
  ): Promise<void> {
    try {
      const { data: campaign } = await this.supabase
        .from('campaigns')
        .select('team_id')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        await this.supabase
          .from('ab_test_events')
          .insert({
            team_id: campaign.team_id,
            campaign_id: campaignId,
            sequence_id: sequenceId,
            event_type: eventType,
            winner_variant_id: result.winnerId,
            metric: result.metric,
            confidence: result.confidence,
            metadata: {
              variants: result.variants.map(v => ({
                id: v.variantId,
                name: v.variantName,
                sent: v.sentCount,
                [result.metric]: v[result.metric],
              })),
            },
          });
      }
    } catch (error) {
      console.error('Failed to log optimization event:', error);
    }
  }
}
