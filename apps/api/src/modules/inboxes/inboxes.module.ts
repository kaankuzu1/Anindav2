import { Module } from '@nestjs/common';
import { InboxesController } from './inboxes.controller';
import { InboxesService } from './inboxes.service';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';

@Module({
  controllers: [InboxesController],
  providers: [InboxesService, SupabaseAuthGuard],
  exports: [InboxesService],
})
export class InboxesModule {}
