import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HasuraModule } from '../hasura/hasura.module';
import { MtnMomoDatabaseService } from './mtn-momo-database.service';
import { MtnMomoController } from './mtn-momo.controller';
import { MtnMomoService } from './mtn-momo.service';

@Module({
  imports: [ConfigModule, HasuraModule],
  controllers: [MtnMomoController],
  providers: [MtnMomoService, MtnMomoDatabaseService],
  exports: [MtnMomoService, MtnMomoDatabaseService],
})
export class MtnMomoModule {}
