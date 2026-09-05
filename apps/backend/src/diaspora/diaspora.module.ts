import { Global, Module } from '@nestjs/common';
import { FxEstimateService } from './fx-estimate.service';

@Global()
@Module({
  providers: [FxEstimateService],
  exports: [FxEstimateService],
})
export class DiasporaModule {}
