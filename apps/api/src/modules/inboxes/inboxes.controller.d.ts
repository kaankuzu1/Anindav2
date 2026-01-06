import { InboxesService } from './inboxes.service';
export declare class InboxesController {
    private readonly inboxesService;
    constructor(inboxesService: InboxesService);
    getInboxes(req: any, teamId: string): Promise<never[]>;
    getInbox(inboxId: string, teamId: string): Promise<never>;
    updateInboxSettings(inboxId: string, teamId: string, body: any): Promise<never>;
    pauseInbox(inboxId: string, teamId: string): Promise<never>;
    resumeInbox(inboxId: string, teamId: string): Promise<never>;
    deleteInbox(inboxId: string, teamId: string): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=inboxes.controller.d.ts.map