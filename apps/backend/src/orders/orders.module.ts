import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { HasuraUserService } from '../hasura/hasura-user.service';

@Module({
  controllers: [OrdersController],
  providers: [HasuraUserService],
})
export class OrdersModule {} 