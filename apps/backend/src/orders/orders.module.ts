import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from '../accounts/accounts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ConfigModule, HasuraModule, AccountsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
