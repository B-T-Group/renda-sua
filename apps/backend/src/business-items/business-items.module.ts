import { Module } from '@nestjs/common';
import { BusinessItemsController } from './business-items.controller';
import { BusinessItemsService } from './business-items.service';
import { ItemDealsService } from '../item-deals/item-deals.service';

@Module({
  controllers: [BusinessItemsController],
  providers: [BusinessItemsService, ItemDealsService],
  exports: [BusinessItemsService, ItemDealsService],
})
export class BusinessItemsModule {}
