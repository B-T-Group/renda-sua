import { Module } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { LoyaltyService } from './loyalty.service';

@Module({
  providers: [LoyaltyService, HasuraSystemService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}

