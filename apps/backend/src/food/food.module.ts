import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoodService } from './food.service';
import { FoodOrderStockService } from './food-order-stock.service';

@Module({
  imports: [AuthModule],
  providers: [FoodService, FoodOrderStockService],
  exports: [FoodService, FoodOrderStockService],
})
export class FoodModule {}
