import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import { decodeTrackingId } from '@aninda/shared';

@Injectable()
export class TrackingService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Record an email open event
   */
  async recordOpen(trackingId: string): Promise<void> {
    try {
      const emailId = decodeTrackingId(trackingId);

      // Get the email record
      const { data: email, error: emailError } = await this.supabase
        .from('emails')
        .select('id, team_id, lead_id, campaign_id, variant_id')
        .eq('id', emailId)
        .single();

      if (emailError || !email) {
        console.log(`Tracking: Email not found for tracking ID ${trackingId}`);
        return;
      }

      // Atomically increment open_count and set opened_at
      await this.supabase.rpc('increment_email_open', { p_email_id: emailId });

      // Always log the event (for analytics - tracks multiple opens)
      await this.supabase
        .from('email_events')
        .insert({
          team_id: email.team_id,
          email_id: emailId,
          event_type: 'opened',
          metadata: {
            tracking_id: trackingId,
          },
        });

      // Update campaign stats
      if (email.campaign_id) {
        await this.incrementCampaignOpens(email.campaign_id);
      }

      // Update A/B test variant stats
      if (email.variant_id) {
        try {
          await this.supabase.rpc('increment_variant_stat', {
            p_variant_id: email.variant_id,
            p_stat: 'opened',
          });
        } catch (err) {
          console.warn('Failed to increment variant opened count:', err);
        }
      }
    } catch (error) {
      console.error('Tracking: Error recording open:', error);
    }
  }

  /**
   * Record a link click event
   */
  async recordClick(trackingId: string, url: string): Promise<void> {
    try {
      const emailId = decodeTrackingId(trackingId);

      // Get the email record
      const { data: email, error: emailError } = await this.supabase
        .from('emails')
        .select('id, team_id, lead_id, campaign_id, variant_id')
        .eq('id', emailId)
        .single();

      if (emailError || !email) {
        console.log(`Tracking: Email not found for tracking ID ${trackingId}`);
        return;
      }

      // Atomically increment click_count and set clicked_at
      await this.supabase.rpc('increment_email_click', { p_email_id: emailId });

      // Log the click event
      await this.supabase
        .from('email_events')
        .insert({
          team_id: email.team_id,
          email_id: emailId,
          event_type: 'clicked',
          metadata: {
            tracking_id: trackingId,
            url,
          },
        });

      // Update campaign stats
      if (email.campaign_id) {
        await this.incrementCampaignClicks(email.campaign_id);
      }

      // Update A/B test variant stats
      if (email.variant_id) {
        try {
          await this.supabase.rpc('increment_variant_stat', {
            p_variant_id: email.variant_id,
            p_stat: 'clicked',
          });
        } catch (err) {
          console.warn('Failed to increment variant clicked count:', err);
        }
      }
    } catch (error) {
      console.error('Tracking: Error recording click:', error);
    }
  }

  private async incrementCampaignOpens(campaignId: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_campaign_opens', { campaign_id: campaignId });
    } catch (err) {
      console.warn('Failed to increment campaign opens:', err);
    }
  }

  private async incrementCampaignClicks(campaignId: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_campaign_clicks', { campaign_id: campaignId });
    } catch (err) {
      console.warn('Failed to increment campaign clicks:', err);
    }
  }
}
