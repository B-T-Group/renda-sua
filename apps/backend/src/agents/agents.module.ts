import { Module } from '@nestjs/common';
import { CommissionsModule } from '../commissions/commissions.module';
import { HasuraModule } from '../hasura/hasura.module';
import { AgentHoldService } from './agent-hold.service';
import { AgentReferralsService } from './agent-referrals.service';
import { AgentsController } from './agents.controller';

@Module({
  imports: [HasuraModule, CommissionsModule],
  controllers: [AgentsController],
  providers: [AgentHoldService, AgentReferralsService],
  exports: [AgentHoldService, AgentReferralsService],
})
export class AgentsModule {}
