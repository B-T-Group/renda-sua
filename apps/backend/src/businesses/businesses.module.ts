import { Module } from '@nestjs/common';
import { BusinessReferralsModule } from '../business-referrals/business-referrals.module';
import { HasuraModule } from '../hasura/hasura.module';
import { BusinessesController } from './businesses.controller';

@Module({
  imports: [HasuraModule, BusinessReferralsModule],
  controllers: [BusinessesController],
})
export class BusinessesModule {}
