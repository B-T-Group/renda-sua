import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HasuraModule } from '../hasura/hasura.module';
import { AirtelMoneyDatabaseService } from './airtel-money-database.service';
import { AirtelMoneyController } from './airtel-money.controller';
import { AirtelMoneyService } from './airtel-money.service';

@Module({
  imports: [ConfigModule, HasuraModule],
  controllers: [AirtelMoneyController],
  providers: [AirtelMoneyService, AirtelMoneyDatabaseService],
  exports: [AirtelMoneyService, AirtelMoneyDatabaseService],
})
export class AirtelMoneyModule {}
