import { Module, forwardRef } from '@nestjs/common';
import { BusinessItemsController } from './business-items.controller';
import { BusinessItemsService } from './business-items.service';
import { ItemDealsService } from '../item-deals/item-deals.service';
import { BusinessImagesModule } from '../business-images/business-images.module';
import { AiModule } from '../ai/ai.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [
    BusinessImagesModule,
    forwardRef(() => AiModule),
    ItemsModule,
  ],
  controllers: [BusinessItemsController],
  providers: [BusinessItemsService, ItemDealsService],
  exports: [BusinessItemsService, ItemDealsService],
})
export class BusinessItemsModule {}
