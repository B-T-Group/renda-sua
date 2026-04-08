import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HasuraModule } from '../hasura/hasura.module';
import { OrangeMomoDatabaseService } from './orange-momo-database.service';
import { OrangeMomoController } from './orange-momo.controller';
import { OrangeMomoService } from './orange-momo.service';

@Module({
  imports: [ConfigModule, HasuraModule],
  controllers: [OrangeMomoController],
  providers: [OrangeMomoService, OrangeMomoDatabaseService],
  exports: [OrangeMomoService, OrangeMomoDatabaseService],
})
export class OrangeMomoModule {}
