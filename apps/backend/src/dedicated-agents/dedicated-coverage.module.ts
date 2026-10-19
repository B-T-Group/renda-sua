import { Module } from '@nestjs/common';
import { AgentContractsModule } from '../agent-contracts/agent-contracts.module';
import { AgentsModule } from '../agents/agents.module';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { HasuraModule } from '../hasura/hasura.module';
import { DedicatedAgentsConfigModule } from './dedicated-agents-config.module';
import { DedicatedCheckoutCoverageService } from './dedicated-checkout-coverage.service';
import { DedicatedCoverageService } from './dedicated-coverage.service';

/**
 * #594 coverage/eligibility read side (AC-E1/E2), split out so delivery
 * availability and checkout (OrdersModule's dependencies) can use it without
 * importing DedicatedAgentsModule, which imports OrdersModule through
 * DelegationsModule.
 */
@Module({
  imports: [
    HasuraModule,
    DedicatedAgentsConfigModule,
    AgentsModule,
    AgentContractsModule,
    DeliveryConfigModule,
    DeliveryModule,
  ],
  providers: [DedicatedCoverageService, DedicatedCheckoutCoverageService],
  exports: [DedicatedAgentsConfigModule, DedicatedCoverageService, DedicatedCheckoutCoverageService],
})
export class DedicatedCoverageModule {}
