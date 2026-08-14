import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { BusinessDelegationsController } from './business-delegations.controller';
import { BusinessDelegationsService } from './business-delegations.service';
import { DelegationAccessService } from './delegation-access.service';
import { DelegationGuard } from './delegation.guard';
import { DelegateOrdersController } from './delegate-orders.controller';
import { DelegateOrdersService } from './delegate-orders.service';
import { LocationDelegationsFlagService } from './location-delegations-flag.service';
import { PublicInviteController } from './public-invite.controller';
import { PublicInviteService } from './public-invite.service';

@Module({
  imports: [AuthModule, NotificationsModule, OrdersModule, MessagingModule],
  controllers: [
    BusinessDelegationsController,
    PublicInviteController,
    DelegateOrdersController,
  ],
  providers: [
    LocationDelegationsFlagService,
    DelegationAccessService,
    DelegationGuard,
    BusinessDelegationsService,
    PublicInviteService,
    DelegateOrdersService,
  ],
  exports: [LocationDelegationsFlagService, DelegationAccessService],
})
export class DelegationsModule {}
