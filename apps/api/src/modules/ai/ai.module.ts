import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { DatabaseModule } from '../../shared/database/database.module';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [AIController],
  providers: [AIService, SupabaseAuthGuard],
  exports: [AIService],
})
export class AIModule {}
