import { forwardRef, Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { OrderQueueService } from './order-queue.service';
import { AdminRefundsController } from './admin-refunds.controller';
import { BusinessClawbackService } from './business-clawback.service';
import { OrderRefundsController } from './order-refunds.controller';
import { OrderRefundsService } from './order-refunds.service';
import { RefundConfigService } from './refund-config.service';
import { RefundDestinationRouter } from './refund-destination.router';
import { RefundEventService } from './refund-event.service';
import { RefundPaymentService } from './refund-payment.service';
import { ReturnWorkflowService } from './return-workflow.service';
import { WalletRefundExecutor } from './wallet-refund.executor';

@Module({
  imports: [
    AccountsModule,
    AdminAuthModule,
    forwardRef(() => StripePaymentsModule),
  ],
  controllers: [OrderRefundsController, AdminRefundsController],
  providers: [
    OrderQueueService,
    RefundConfigService,
    RefundDestinationRouter,
    RefundEventService,
    WalletRefundExecutor,
    BusinessClawbackService,
    RefundPaymentService,
    ReturnWorkflowService,
    OrderRefundsService,
  ],
  exports: [
    RefundPaymentService,
    OrderRefundsService,
    RefundEventService,
    RefundConfigService,
  ],
})
export class RefundsModule {}
