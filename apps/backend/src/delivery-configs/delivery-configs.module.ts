import { Module } from '@nestjs/common';
import { DeliveryConfigService } from './delivery-configs.service';
import { HasuraModule } from '../hasura/hasura.module';

@Module({
  imports: [HasuraModule],
  providers: [DeliveryConfigService],
  exports: [DeliveryConfigService],
})
export class DeliveryConfigModule {}

