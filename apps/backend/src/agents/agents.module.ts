import { Module } from '@nestjs/common';
import { CommissionsModule } from '../commissions/commissions.module';
import { HasuraModule } from '../hasura/hasura.module';
import { BusinessReferralPayoutsModule } from '../business-referral-payouts/business-referral-payouts.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { AgentHoldService } from './agent-hold.service';
import { AgentReferralsService } from './agent-referrals.service';
import { AgentsController } from './agents.controller';

@Module({
  imports: [
    HasuraModule,
    CommissionsModule,
    ReferralsModule,
    BusinessReferralPayoutsModule,
  ],
  controllers: [AgentsController],
  providers: [AgentHoldService, AgentReferralsService, ConfigurationsService],
  exports: [AgentHoldService, AgentReferralsService],
})
export class AgentsModule {}
