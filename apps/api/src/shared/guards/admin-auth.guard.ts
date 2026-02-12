import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try to get token from Authorization header first
    let token: string | undefined;
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    }

    // Fallback: Check query parameter (used for OAuth redirect flows)
    if (!token && request.query?.token) {
      token = request.query.token as string;
    }

    if (!token) {
      throw new UnauthorizedException('No admin token provided');
    }

    const secret = this.configService.getOrThrow<string>('ADMIN_JWT_SECRET');

    try {
      const payload = jwt.verify(token, secret) as { role: string };
      if (payload.role !== 'admin') {
        throw new UnauthorizedException('Invalid admin token');
      }
      request.user = { role: 'admin' };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }
}
