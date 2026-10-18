import { Module } from '@nestjs/common';
import { AgentContractsModule } from '../agent-contracts/agent-contracts.module';
import { AgentsModule } from '../agents/agents.module';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { HasuraModule } from '../hasura/hasura.module';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import { DedicatedCoverageService } from './dedicated-coverage.service';

/**
 * #594 dedicated delivery agents, behind `dedicated_agents_enabled` (off).
 * PR 1: config. PR 2: coverage/eligibility core (no callers yet).
 */
@Module({
  imports: [HasuraModule, AgentsModule, AgentContractsModule, DeliveryConfigModule],
  providers: [DedicatedAgentsConfigService, DedicatedCoverageService],
  exports: [DedicatedAgentsConfigService, DedicatedCoverageService],
})
export class DedicatedAgentsModule {}
