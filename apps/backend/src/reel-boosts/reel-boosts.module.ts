import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ReelBoostsController } from './reel-boosts.controller';
import { ReelBoostsService } from './reel-boosts.service';

@Module({
  imports: [AuthModule, HasuraModule],
  controllers: [ReelBoostsController],
  providers: [ReelBoostsService],
  exports: [ReelBoostsService],
})
export class ReelBoostsModule {}
