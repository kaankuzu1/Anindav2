import { CampaignsService } from './campaigns.service';
export declare class CampaignsController {
    private readonly campaignsService;
    constructor(campaignsService: CampaignsService);
    getCampaigns(teamId: string): Promise<never[]>;
    getCampaign(campaignId: string, teamId: string): Promise<never>;
    createCampaign(teamId: string, body: any): Promise<never>;
    updateCampaign(campaignId: string, teamId: string, body: any): Promise<never>;
    startCampaign(campaignId: string, teamId: string): Promise<never>;
    pauseCampaign(campaignId: string, teamId: string): Promise<never>;
    deleteCampaign(campaignId: string, teamId: string): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=campaigns.controller.d.ts.map