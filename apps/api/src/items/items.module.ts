import { Module } from '@nestjs/common';

import { CategoriesModule } from '../categories/categories.module';

import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  imports: [CategoriesModule],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
