import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationsService } from '../admin/configurations.service';
import { DatabaseModule } from '../database/database.module';
import { HasuraModule } from '../hasura/hasura.module';
import { LaunchPromoCronService } from './launch-promo-cron.service';
import { LaunchPromoInternalController } from './launch-promo-internal.controller';
import { LaunchPromoService } from './launch-promo.service';

@Module({
  imports: [ConfigModule, DatabaseModule, HasuraModule],
  controllers: [LaunchPromoInternalController],
  providers: [
    LaunchPromoService,
    LaunchPromoCronService,
    ConfigurationsService,
  ],
  exports: [LaunchPromoService],
})
export class LaunchPromoModule {}
