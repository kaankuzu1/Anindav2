import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { LeadsController } from './leads.controller';
import { UnsubscribeController } from './unsubscribe.controller';
import { LeadsService } from './leads.service';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [LeadsController, UnsubscribeController],
  providers: [LeadsService, SupabaseAuthGuard],
  exports: [LeadsService],
})
export class LeadsModule {}
