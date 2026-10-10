import { Module, forwardRef } from '@nestjs/common';
import { CommissionsModule } from '../commissions/commissions.module';
import { HasuraModule } from '../hasura/hasura.module';
import { BusinessReferralPayoutsModule } from '../business-referral-payouts/business-referral-payouts.module';
import { PaymentProgramsModule } from '../payment-programs/payment-programs.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { AgentHoldService } from './agent-hold.service';
import { AgentHoldLossGuardService } from './agent-hold-loss-guard.service';
import { AgentPayBoardService } from './agent-pay-board.service';
import { AgentReferralsService } from './agent-referrals.service';
import { AgentsController } from './agents.controller';

@Module({
  imports: [
    HasuraModule,
    CommissionsModule,
    ReferralsModule,
    BusinessReferralPayoutsModule,
    forwardRef(() => PaymentProgramsModule),
  ],
  controllers: [AgentsController],
  providers: [
    AgentHoldService,
    AgentHoldLossGuardService,
    AgentReferralsService,
    AgentPayBoardService,
    ConfigurationsService,
  ],
  exports: [AgentHoldService, AgentReferralsService],
})
export class AgentsModule {}
