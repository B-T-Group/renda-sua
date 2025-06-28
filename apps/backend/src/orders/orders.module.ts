import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

@Module({
  controllers: [OrdersController],
  providers: [HasuraUserService, HasuraSystemService],
})
export class OrdersModule {}
