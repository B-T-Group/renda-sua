import { Module } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, HasuraUserService, HasuraSystemService],
})
export class OrdersModule {}
