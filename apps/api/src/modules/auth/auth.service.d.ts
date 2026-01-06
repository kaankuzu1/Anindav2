import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@aninda/database';
export declare class AuthService {
    private readonly supabase;
    constructor(supabase: SupabaseClient<Database>);
    getUserById(userId: string): Promise<null>;
    getUserTeams(userId: string): Promise<never[]>;
    createUserProfile(userId: string, email: string, fullName?: string): Promise<never>;
}
//# sourceMappingURL=auth.service.d.ts.map