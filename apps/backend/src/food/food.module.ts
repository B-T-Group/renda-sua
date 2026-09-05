import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoodService } from './food.service';
import { FoodOrdersService } from './food-orders.service';

@Module({
  imports: [AuthModule],
  providers: [FoodService, FoodOrdersService],
  exports: [FoodService, FoodOrdersService],
})
export class FoodModule {}
