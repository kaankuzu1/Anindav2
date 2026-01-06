import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import type { Database } from '@aninda/database';
export declare class InboxesService {
    private readonly supabase;
    private readonly configService;
    private encryptionKey;
    constructor(supabase: SupabaseClient<Database>, configService: ConfigService);
    getInboxes(teamId: string): Promise<never[]>;
    getInbox(inboxId: string, teamId: string): Promise<never>;
    createOAuthInbox(teamId: string, email: string, provider: 'google' | 'microsoft', accessToken: string, refreshToken: string, expiresAt?: Date): Promise<never>;
    updateInboxSettings(inboxId: string, teamId: string, settings: Partial<{
        daily_send_limit: number;
        hourly_limit: number;
        min_delay_seconds: number;
        max_delay_seconds: number;
        send_window_start: string;
        send_window_end: string;
        send_window_timezone: string;
        weekends_enabled: boolean;
    }>): Promise<never>;
    pauseInbox(inboxId: string, teamId: string): Promise<never>;
    resumeInbox(inboxId: string, teamId: string): Promise<never>;
    deleteInbox(inboxId: string, teamId: string): Promise<{
        success: boolean;
    }>;
    getDecryptedCredentials(inboxId: string, teamId: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresAt: Date | undefined;
    } | null>;
    updateCredentials(inboxId: string, accessToken: string, refreshToken: string, expiresAt?: Date): Promise<void>;
    incrementSentCount(inboxId: string): Promise<void>;
}
//# sourceMappingURL=inboxes.service.d.ts.map