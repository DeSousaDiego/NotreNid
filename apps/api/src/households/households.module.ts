import { Module } from '@nestjs/common';

import { HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [HouseholdsController],
  providers: [HouseholdsService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
