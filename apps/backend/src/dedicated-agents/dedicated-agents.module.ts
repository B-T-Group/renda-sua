import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';

/** #594 dedicated delivery agents. PR 1: config only; behaviour lands in later PRs behind the flag. */
@Module({
  imports: [HasuraModule],
  providers: [DedicatedAgentsConfigService],
  exports: [DedicatedAgentsConfigService],
})
export class DedicatedAgentsModule {}
