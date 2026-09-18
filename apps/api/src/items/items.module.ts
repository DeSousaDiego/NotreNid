import { Module } from '@nestjs/common';

import { BarcodeModule } from './barcode/barcode.module';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [CategoriesModule, BarcodeModule],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
