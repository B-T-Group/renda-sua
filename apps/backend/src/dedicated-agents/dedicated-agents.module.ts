import { Module, forwardRef } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { AgentContractsModule } from '../agent-contracts/agent-contracts.module';
import { AgentsModule } from '../agents/agents.module';
import { DelegationsModule } from '../delegations/delegations.module';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SiteEventsModule } from '../site-events/site-events.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { DedicatedAdminPostingsController, DedicatedAdminViewsController } from './dedicated-admin-views.controller';
import { DedicatedAdminViewsService } from './dedicated-admin-views.service';
import { DedicatedAgentsAdminController } from './dedicated-agents-admin.controller';
import { DedicatedAgentsAgentController } from './dedicated-agents-agent.controller';
import { DedicatedAgentsBusinessController } from './dedicated-agents-business.controller';
import { DedicatedAgentsConfigModule } from './dedicated-agents-config.module';
import { DedicatedAssignmentsService } from './dedicated-assignments.service';
import { DedicatedCoverageModule } from './dedicated-coverage.module';
import { DedicatedLocationAccessService } from './dedicated-location-access.service';
import { DedicatedOpportunitiesController } from './dedicated-opportunities.controller';
import { DedicatedOpportunitiesService } from './dedicated-opportunities.service';
import { DedicatedPostingsBusinessController } from './dedicated-postings-business.controller';
import { DedicatedPostingsSweeperService } from './dedicated-postings-sweeper.service';
import { DedicatedPostingsService } from './dedicated-postings.service';

/**
 * #594 dedicated delivery agents, behind `dedicated_agents_enabled` (off).
 * PR 1: config. PR 2: coverage/eligibility core. PR 3: assignment lifecycle
 * (super-user assign, business pause/remove, Off today, My stores) and
 * location pickup slots. PR 4: coverage lives in DedicatedCoverageModule so
 * checkout can use it. PR 7: postings, applications, the locked accept and
 * Opportunities, with the 14-day expiry sweeper. PR 8: super-user views
 * (S1 list + S5 relation badge, S3 postings, S4 coverage, S2 picker) and analytics.
 */
@Module({
  imports: [
    // QA #619 N5: PaymentRoutingService for the store's rail in the picker/cards.
    forwardRef(() => StripePaymentsModule),
    HasuraModule,
    DedicatedAgentsConfigModule,
    DedicatedCoverageModule,
    AgentsModule,
    AgentContractsModule,
    DeliveryConfigModule,
    NotificationsModule,
    DelegationsModule,
    AdminAuthModule,
    SiteEventsModule,
  ],
  controllers: [
    DedicatedAgentsAdminController,
    DedicatedAdminViewsController,
    DedicatedAdminPostingsController,
    DedicatedAgentsBusinessController,
    DedicatedAgentsAgentController,
    DedicatedPostingsBusinessController,
    DedicatedOpportunitiesController,
  ],
  providers: [
    DedicatedAssignmentsService,
    DedicatedLocationAccessService,
    DedicatedPostingsService,
    DedicatedOpportunitiesService,
    DedicatedPostingsSweeperService,
    DedicatedAdminViewsService,
  ],
  exports: [DedicatedAgentsConfigModule, DedicatedCoverageModule, DedicatedAssignmentsService],
})
export class DedicatedAgentsModule {}
