import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { AgentContractsModule } from '../agent-contracts/agent-contracts.module';
import { AgentsModule } from '../agents/agents.module';
import { DelegationsModule } from '../delegations/delegations.module';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DedicatedAgentsAdminController } from './dedicated-agents-admin.controller';
import { DedicatedAgentsAgentController } from './dedicated-agents-agent.controller';
import { DedicatedAgentsBusinessController } from './dedicated-agents-business.controller';
import { DedicatedAgentsConfigModule } from './dedicated-agents-config.module';
import { DedicatedAssignmentsService } from './dedicated-assignments.service';
import { DedicatedCoverageModule } from './dedicated-coverage.module';
import { DedicatedLocationAccessService } from './dedicated-location-access.service';

/**
 * #594 dedicated delivery agents, behind `dedicated_agents_enabled` (off).
 * PR 1: config. PR 2: coverage/eligibility core. PR 3: assignment lifecycle
 * (super-user assign, business pause/remove, Off today, My stores) and
 * location pickup slots. PR 4: coverage lives in DedicatedCoverageModule so
 * checkout can use it.
 */
@Module({
  imports: [
    HasuraModule,
    DedicatedAgentsConfigModule,
    DedicatedCoverageModule,
    AgentsModule,
    AgentContractsModule,
    DeliveryConfigModule,
    NotificationsModule,
    DelegationsModule,
    AdminAuthModule,
  ],
  controllers: [
    DedicatedAgentsAdminController,
    DedicatedAgentsBusinessController,
    DedicatedAgentsAgentController,
  ],
  providers: [DedicatedAssignmentsService, DedicatedLocationAccessService],
  exports: [DedicatedAgentsConfigModule, DedicatedCoverageModule, DedicatedAssignmentsService],
})
export class DedicatedAgentsModule {}
