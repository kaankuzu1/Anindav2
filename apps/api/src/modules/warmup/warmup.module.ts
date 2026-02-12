import { Module } from '@nestjs/common';
import { WarmupController } from './warmup.controller';
import { WarmupService } from './warmup.service';
import { WarmupAssignmentService } from './warmup-assignment.service';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';

@Module({
  controllers: [WarmupController],
  providers: [WarmupService, WarmupAssignmentService, SupabaseAuthGuard],
  exports: [WarmupService, WarmupAssignmentService],
})
export class WarmupModule {}
