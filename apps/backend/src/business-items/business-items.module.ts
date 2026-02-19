import { Module } from '@nestjs/common';
import { BusinessItemsController } from './business-items.controller';
import { BusinessItemsService } from './business-items.service';

@Module({
  controllers: [BusinessItemsController],
  providers: [BusinessItemsService],
  exports: [BusinessItemsService],
})
export class BusinessItemsModule {}
