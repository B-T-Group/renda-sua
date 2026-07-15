import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessItemsController } from './business-items.controller';
import { BusinessItemsService } from './business-items.service';
import { BusinessItemsAccessService } from './business-items-access.service';
import { BusinessLocationTransferService } from './business-location-transfer.service';
import { ItemDealsService } from '../item-deals/item-deals.service';
import { BusinessImagesModule } from '../business-images/business-images.module';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { ItemsModule } from '../items/items.module';
import { ItemAiReviewModule } from '../item-ai-review/item-ai-review.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { StripeTaxModule } from '../stripe-tax/stripe-tax.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    BusinessImagesModule,
    AiGenerationModule,
    ItemsModule,
    ItemAiReviewModule,
    StripePaymentsModule,
    StripeTaxModule,
    MerchantLifecycleModule,
    NotificationsModule,
  ],
  controllers: [BusinessItemsController],
  providers: [
    BusinessItemsService,
    BusinessItemsAccessService,
    BusinessLocationTransferService,
    ItemDealsService,
  ],
  exports: [
    BusinessItemsService,
    BusinessItemsAccessService,
    BusinessLocationTransferService,
    ItemDealsService,
  ],
})
export class BusinessItemsModule {}
