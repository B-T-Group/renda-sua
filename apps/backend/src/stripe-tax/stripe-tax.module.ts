import { Module, forwardRef } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { OrderTaxLifecycleService } from './order-tax-lifecycle.service';
import { OrderTaxSnapshotRepository } from './order-tax-snapshot.repository';
import { StripeTaxAdminController } from './stripe-tax-admin.controller';
import { StripeTaxCalculationService } from './stripe-tax-calculation.service';
import { StripeTaxCheckoutBuilderService } from './stripe-tax-checkout-builder.service';
import { StripeTaxCodesDatabaseService } from './stripe-tax-codes-database.service';
import { StripeTaxCodesService } from './stripe-tax-codes.service';
import { StripeTaxController } from './stripe-tax.controller';
import { StripeTaxOrderPersistenceService } from './stripe-tax-order-persistence.service';

@Module({
  imports: [AdminAuthModule, forwardRef(() => StripePaymentsModule)],
  controllers: [StripeTaxController, StripeTaxAdminController],
  providers: [
    StripeTaxCodesDatabaseService,
    StripeTaxCodesService,
    StripeTaxCheckoutBuilderService,
    StripeTaxOrderPersistenceService,
    StripeTaxCalculationService,
    OrderTaxSnapshotRepository,
    OrderTaxLifecycleService,
  ],
  exports: [
    StripeTaxCodesService,
    StripeTaxCodesDatabaseService,
    StripeTaxCheckoutBuilderService,
    StripeTaxOrderPersistenceService,
    StripeTaxCalculationService,
    OrderTaxLifecycleService,
  ],
})
export class StripeTaxModule {}
