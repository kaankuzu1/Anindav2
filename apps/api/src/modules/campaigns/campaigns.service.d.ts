import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@aninda/database';
export declare class CampaignsService {
    private readonly supabase;
    constructor(supabase: SupabaseClient<Database>);
    getCampaigns(teamId: string): Promise<never[]>;
    getCampaign(campaignId: string, teamId: string): Promise<never>;
    createCampaign(teamId: string, input: {
        name: string;
        lead_list_id?: string;
        settings?: Record<string, unknown>;
    }): Promise<never>;
    updateCampaign(campaignId: string, teamId: string, input: Partial<{
        name: string;
        settings: Record<string, unknown>;
    }>): Promise<never>;
    startCampaign(campaignId: string, teamId: string): Promise<never>;
    pauseCampaign(campaignId: string, teamId: string): Promise<never>;
    deleteCampaign(campaignId: string, teamId: string): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=campaigns.service.d.ts.map