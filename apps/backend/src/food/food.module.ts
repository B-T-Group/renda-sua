import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoodService } from './food.service';

@Module({
  imports: [AuthModule],
  providers: [FoodService],
  exports: [FoodService],
})
export class FoodModule {}
