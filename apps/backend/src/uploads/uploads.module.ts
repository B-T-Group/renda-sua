import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ServicesModule } from '../services/services.module';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [AuthModule, HasuraModule, ServicesModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
