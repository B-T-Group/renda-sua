import { Module } from '@nestjs/common';
import { BusinessItemsController } from './business-items.controller';
import { BusinessItemsService } from './business-items.service';
import { ItemDealsService } from '../item-deals/item-deals.service';
import { BusinessImagesModule } from '../business-images/business-images.module';

@Module({
  imports: [BusinessImagesModule],
  controllers: [BusinessItemsController],
  providers: [BusinessItemsService, ItemDealsService],
  exports: [BusinessItemsService, ItemDealsService],
})
export class BusinessItemsModule {}
