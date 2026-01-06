import { Module } from '@nestjs/common';
import { WarmupController } from './warmup.controller';
import { WarmupService } from './warmup.service';

@Module({
  controllers: [WarmupController],
  providers: [WarmupService],
  exports: [WarmupService],
})
export class WarmupModule {}
