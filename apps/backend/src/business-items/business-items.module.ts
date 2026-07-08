import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessItemsController } from './business-items.controller';
import { BusinessItemsService } from './business-items.service';
import { BusinessItemsAccessService } from './business-items-access.service';
import { ItemDealsService } from '../item-deals/item-deals.service';
import { BusinessImagesModule } from '../business-images/business-images.module';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { ItemsModule } from '../items/items.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';

@Module({
  imports: [
    AuthModule,
    BusinessImagesModule,
    AiGenerationModule,
    ItemsModule,
    StripePaymentsModule,
    MerchantLifecycleModule,
  ],
  controllers: [BusinessItemsController],
  providers: [BusinessItemsService, BusinessItemsAccessService, ItemDealsService],
  exports: [BusinessItemsService, ItemDealsService],
})
export class BusinessItemsModule {}
