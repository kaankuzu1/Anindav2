import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminInboxesService } from './admin-inboxes.service';
import { AdminAuthGuard } from '../../shared/guards/admin-auth.guard';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminInboxesService, AdminAuthGuard],
  exports: [AdminInboxesService],
})
export class AdminModule {}
