import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';

/**
 * Just the #594 flag/config reader, so low-level modules (DeliveryModule) can
 * read `dedicated_agents_enabled` without pulling in DedicatedAgentsModule's
 * dependency tree (orders, notifications, delegations).
 */
@Module({
  imports: [HasuraModule],
  providers: [DedicatedAgentsConfigService],
  exports: [DedicatedAgentsConfigService],
})
export class DedicatedAgentsConfigModule {}
