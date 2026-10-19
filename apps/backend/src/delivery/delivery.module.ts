import { Module } from '@nestjs/common';
import { DedicatedAgentsConfigModule } from '../dedicated-agents/dedicated-agents-config.module';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { DelegationAccessService } from '../delegations/delegation-access.service';
import { HasuraModule } from '../hasura/hasura.module';
import { RbacModule } from '../rbac/rbac.module';
import { DeliveryEstimateController } from './delivery-estimate.controller';
import { DeliveryEstimateService } from './delivery-estimate.service';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliveryWindowsController } from './delivery-windows.controller';
import { DeliveryWindowsService } from './delivery-windows.service';

@Module({
  imports: [HasuraModule, RbacModule, DeliveryConfigModule, DedicatedAgentsConfigModule],
  controllers: [DeliveryWindowsController, DeliveryEstimateController],
  providers: [
    // Stateless (Hasura reads only); provided here rather than importing
    // DelegationsModule, which imports OrdersModule (a cycle).
    DelegationAccessService,
    DeliverySlotsService,
    DeliveryWindowsService,
    DeliveryEstimateService,
  ],
  exports: [
    DeliverySlotsService,
    DeliveryWindowsService,
    DeliveryEstimateService,
  ],
})
export class DeliveryModule {}
