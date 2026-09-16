import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { BusinessFollowsController } from './business-follows.controller';
import { BusinessFollowsService } from './business-follows.service';

@Module({
  imports: [HasuraModule],
  controllers: [BusinessFollowsController],
  providers: [BusinessFollowsService],
  exports: [BusinessFollowsService],
})
export class BusinessFollowsModule {}
