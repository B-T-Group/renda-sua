import { Module, forwardRef } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CashAdvanceService } from './cash-advance.service';
import { PartnerBusinessesService } from './partner-businesses.service';
import { PaymentProgramsAdminController } from './payment-programs-admin.controller';
import { PaymentProgramsUserController } from './payment-programs-user.controller';
import { PaymentScheduleCatalogService } from './payment-schedule-catalog.service';
import { PaymentScheduleInternalController } from './payment-schedule-internal.controller';
import { PaymentScheduleRunnerService } from './payment-schedule-runner.service';
import { PurchaseCreditsService } from './purchase-credits.service';

@Module({
  imports: [AdminAuthModule, forwardRef(() => NotificationsModule)],
  controllers: [
    PaymentProgramsAdminController,
    PaymentProgramsUserController,
    PaymentScheduleInternalController,
  ],
  providers: [
    PurchaseCreditsService,
    CashAdvanceService,
    PaymentScheduleCatalogService,
    PaymentScheduleRunnerService,
    PartnerBusinessesService,
  ],
  exports: [PurchaseCreditsService],
})
export class PaymentProgramsModule {}
