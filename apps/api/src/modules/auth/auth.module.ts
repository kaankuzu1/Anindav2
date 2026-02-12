import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseStrategy } from './supabase.strategy';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';
import { AdminAuthGuard } from '../../shared/guards/admin-auth.guard';
import { InboxesModule } from '../inboxes/inboxes.module';
import { AdminModule } from '../admin/admin.module';
import { DatabaseModule } from '../../shared/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('SUPABASE_JWT_SECRET') ||
          configService.get<string>('JWT_SECRET') ||
          'fallback-secret-for-local-dev',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => InboxesModule),
    AdminModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SupabaseStrategy, SupabaseAuthGuard, AdminAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
