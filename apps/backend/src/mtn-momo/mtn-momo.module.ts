import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MtnMomoController } from './mtn-momo.controller';
import { MtnMomoService } from './mtn-momo.service';

@Module({
  imports: [ConfigModule],
  controllers: [MtnMomoController],
  providers: [MtnMomoService],
  exports: [MtnMomoService],
})
export class MtnMomoModule {}
