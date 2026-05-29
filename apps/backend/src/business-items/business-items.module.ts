import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessItemsController } from './business-items.controller';
import { BusinessItemsService } from './business-items.service';
import { BusinessItemsAccessService } from './business-items-access.service';
import { ItemDealsService } from '../item-deals/item-deals.service';
import { BusinessImagesModule } from '../business-images/business-images.module';
import { AiModule } from '../ai/ai.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [
    AuthModule,
    BusinessImagesModule,
    forwardRef(() => AiModule),
    ItemsModule,
  ],
  controllers: [BusinessItemsController],
  providers: [BusinessItemsService, BusinessItemsAccessService, ItemDealsService],
  exports: [BusinessItemsService, ItemDealsService],
})
export class BusinessItemsModule {}
