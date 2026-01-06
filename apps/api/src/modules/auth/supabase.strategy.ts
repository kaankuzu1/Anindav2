import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';

interface JwtPayload {
  sub: string;
  email: string;
  aud: string;
  role: string;
  iat: number;
  exp: number;
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {
    // Use Supabase anon key's signing secret for JWT verification
    // The JWT secret can be found in Supabase Dashboard > Project Settings > API > JWT Settings
    const jwtSecret = configService.get<string>('SUPABASE_JWT_SECRET') ||
      configService.get<string>('JWT_SECRET') ||
      'your-super-secret-jwt-token-with-at-least-32-characters-long';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: JwtPayload) {
    // Extract token from header for Supabase verification
    const authHeader = (req.headers?.authorization || req.get?.('authorization') || '') as string;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Use Supabase to verify the token - this is the most reliable method
    const { data: { user }, error } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
