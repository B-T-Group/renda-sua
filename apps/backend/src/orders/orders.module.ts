import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from '../accounts/accounts.module';
import { AddressesModule } from '../addresses/addresses.module';
import { GoogleModule } from '../google/google.module';
import { HasuraModule } from '../hasura/hasura.module';
import { OrderStatusService } from './order-status.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    ConfigModule,
    HasuraModule,
    AccountsModule,
    GoogleModule,
    AddressesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStatusService],
})
export class OrdersModule {}
