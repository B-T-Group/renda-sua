import { Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { StripeTaxAdminController } from './stripe-tax-admin.controller';
import { StripeTaxCalculationService } from './stripe-tax-calculation.service';
import { StripeTaxCheckoutBuilderService } from './stripe-tax-checkout-builder.service';
import { StripeTaxCodesDatabaseService } from './stripe-tax-codes-database.service';
import { StripeTaxCodesService } from './stripe-tax-codes.service';
import { StripeTaxController } from './stripe-tax.controller';
import { StripeTaxOrderPersistenceService } from './stripe-tax-order-persistence.service';

@Module({
  imports: [AdminModule, forwardRef(() => StripePaymentsModule)],
  controllers: [StripeTaxController, StripeTaxAdminController],
  providers: [
    StripeTaxCodesDatabaseService,
    StripeTaxCodesService,
    StripeTaxCheckoutBuilderService,
    StripeTaxOrderPersistenceService,
    StripeTaxCalculationService,
  ],
  exports: [
    StripeTaxCodesService,
    StripeTaxCodesDatabaseService,
    StripeTaxCheckoutBuilderService,
    StripeTaxOrderPersistenceService,
    StripeTaxCalculationService,
  ],
})
export class StripeTaxModule {}
