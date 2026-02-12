import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { CustomDomainController } from './custom-domain.controller';
import { CustomDomainService } from './custom-domain.service';

@Module({
  controllers: [TrackingController, CustomDomainController],
  providers: [TrackingService, CustomDomainService],
  exports: [TrackingService, CustomDomainService],
})
export class TrackingModule {}
