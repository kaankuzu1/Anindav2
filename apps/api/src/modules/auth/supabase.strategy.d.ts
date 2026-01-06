import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
interface JwtPayload {
    sub: string;
    email: string;
    aud: string;
    role: string;
    iat: number;
    exp: number;
}
declare const SupabaseStrategy_base: new (...args: any[]) => Strategy;
export declare class SupabaseStrategy extends SupabaseStrategy_base {
    constructor(configService: ConfigService);
    validate(payload: JwtPayload): Promise<{
        sub: string;
        email: string;
        role: string;
    }>;
}
export {};
//# sourceMappingURL=supabase.strategy.d.ts.map